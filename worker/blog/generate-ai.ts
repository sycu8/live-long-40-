import {
  BLOG_AUTHOR_DEFAULT,
  BLOG_THEMES,
  type BlogTheme,
} from "@shared/constants/blog";
import { createId, nowIso } from "@shared/utils/id";
import type { Env } from "../env";
import type { BlogEditorialPost } from "./types";

const DISCLAIMER = `

---

*Bài viết động viên của VivaAge. Không thay lời bác sĩ, không phải tư vấn tiền bạc hay pháp lý.*
`;

function themeForDate(isoDate: string): BlogTheme {
  const day = Number(isoDate.replace(/-/g, "")) || 0;
  return BLOG_THEMES[day % BLOG_THEMES.length]!;
}

function slugifyTitle(title: string, isoDate: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "dong-vien"}-${isoDate}`;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) return null;
  try {
    return JSON.parse(fenced[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Draft one motivational editorial post for a calendar day when the bank is empty.
 * Educational tone only — no diagnosis, no investment advice.
 */
export async function generateEditorialPostWithAi(
  env: Env,
  isoDate: string,
): Promise<BlogEditorialPost | null> {
  if (!env.AI) return null;

  const theme = themeForDate(isoDate);
  const themeHint: Record<BlogTheme, string> = {
    "tinh-than": "tinh thần, hy vọng, giảm tiêu cực",
    "thoi-quen": "thói quen nhỏ đều đặn",
    "suc-khoe": "chăm sóc sức khỏe dịu dàng (không chẩn đoán)",
    "tai-chinh": "lo liệu tiền bạc bình tĩnh (không tư vấn đầu tư)",
    "cham-soc": "chăm sóc người thân và an toàn tại nhà",
  };

  const prompt = `Bạn là biên tập viên Góc động viên của VivaAge (người Việt ngoài 40 tuổi).
Viết MỘT bài tiếng Việt ấm áp, dễ hiểu, chủ đề: ${themeHint[theme]}.
Tuyệt đối không chẩn đoán bệnh, không kê đơn, không tư vấn đầu tư/pháp lý.
Trả về ĐÚNG một JSON (không markdown ngoài JSON):
{"title":"...","excerpt":"1-2 câu","minutes":5,"body":"markdown với ## headings, 400-700 từ"}`;

  const model = "@cf/meta/llama-3.1-8b-instruct";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai = env.AI_GATEWAY_ID
    ? ((env.AI as any).gateway?.(env.AI_GATEWAY_ID) ?? env.AI)
    : env.AI;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await ai.run(model, {
      messages: [
        { role: "system", content: "Chỉ trả JSON hợp lệ. Tiếng Việt tự nhiên." },
        { role: "user", content: prompt },
      ],
      stream: false,
      max_tokens: 1800,
    });
    const text =
      typeof response?.response === "string"
        ? response.response
        : typeof response === "string"
          ? response
          : "";
    const parsed = parseJsonObject(text);
    if (!parsed) return null;
    const title = String(parsed.title ?? "").trim();
    const excerpt = String(parsed.excerpt ?? "").trim();
    const body = String(parsed.body ?? "").trim();
    const minutes = Math.min(
      12,
      Math.max(4, Number(parsed.minutes) || 6),
    );
    if (title.length < 12 || body.length < 200 || excerpt.length < 20) {
      return null;
    }
    return {
      slug: slugifyTitle(title, isoDate),
      title,
      excerpt,
      theme,
      minutes,
      body: `${body.trim()}${DISCLAIMER}`,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "blog_ai_generate_failed",
        error: String(err),
      }),
    );
    return null;
  }
}

export async function insertScheduledPost(
  db: D1Database,
  post: BlogEditorialPost,
  scheduledFor: string,
  status: "scheduled" | "published" = "scheduled",
): Promise<boolean> {
  const now = nowIso();
  const id = createId("blog");
  const publishedAt = status === "published" ? `${scheduledFor}T02:00:00.000Z` : null;
  try {
    await db
      .prepare(
        `INSERT INTO blog_posts (
          id, slug, title, excerpt, theme, reading_minutes, body_markdown,
          status, scheduled_for, published_at, author_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        post.slug,
        post.title,
        post.excerpt,
        post.theme,
        post.minutes,
        post.body,
        status,
        scheduledFor,
        publishedAt,
        BLOG_AUTHOR_DEFAULT,
        now,
        now,
      )
      .run();
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "blog_insert_skipped",
        slug: post.slug,
        error: String(err),
      }),
    );
    return false;
  }
}
