import {
  BLOG_AUTHOR_DEFAULT,
  BLOG_MIN_WORDS,
  BLOG_THEMES,
  countBlogWords,
  type BlogTheme,
} from "@shared/constants/blog";
import {
  defaultSourceIdsForTheme,
  resolveBlogSources,
} from "@shared/content/blog-theme-sources";
import { OFFICIAL_SOURCES } from "@shared/content/official-sources";
import { createId, nowIso } from "@shared/utils/id";
import { WORKERS_AI_TEXT_MODEL } from "../ai/models";
import { formatWorkersAiError, readWorkersAiText, runWorkersAi } from "../ai/run";
import type { Env } from "../env";
import { generateAndStoreBlogCover } from "./images";
import type { BlogEditorialPost } from "./types";

const DISCLAIMER = `

---

*Bài viết giáo dục – động viên của VivaAge, viết ở góc nhìn tư vấn viên hỗ trợ người lớn tuổi. Không thay lời bác sĩ, không phải tư vấn đầu tư hay pháp lý cá nhân. Hãy đối chiếu nguồn chính thống bên dưới và hỏi cơ sở y tế khi cần quyết định cho bản thân.*
`;

function themeForDate(isoDate: string, slot = 0): BlogTheme {
  const day = Number(isoDate.replace(/-/g, "")) || 0;
  return BLOG_THEMES[(day + slot) % BLOG_THEMES.length]!;
}

function slugifyTitle(title: string, isoDate: string, slot = 0): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base || "dong-vien"}-${isoDate}${slot ? `-b${slot + 1}` : ""}`;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced?.[0]) return null;
  try {
    const value: unknown = JSON.parse(fenced[0]);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function logBlogAiFailure(error: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      message: "blog_ai_generate_failed",
      model: WORKERS_AI_TEXT_MODEL,
      error,
    }),
  );
}

function allowlistForPrompt(theme: BlogTheme): string {
  const preferred = defaultSourceIdsForTheme(theme);
  const rows = OFFICIAL_SOURCES.filter((s) => preferred.includes(s.id));
  return rows
    .map((s) => `- ${s.id}: ${s.title} (${s.url})`)
    .join("\n");
}

/**
 * Draft one advisory editorial post (professional counselor tone for older adults).
 * Attaches official source ids + optional Workers AI cover image.
 */
export async function generateEditorialPostWithAi(
  env: Env,
  isoDate: string,
  slot = 0,
): Promise<BlogEditorialPost | null> {
  if (!env.AI) return null;

  const theme = themeForDate(isoDate, slot);
  const themeHint: Record<BlogTheme, string> = {
    "tinh-than": "tinh thần, thích nghi, giảm lo âu (không trị liệu lâm sàng)",
    "thoi-quen": "thói quen nhỏ đều đặn, kỷ luật dịu dàng",
    "suc-khoe": "chăm sóc sức khỏe chủ động (không chẩn đoán, không kê đơn)",
    "tai-chinh": "lo liệu tiền bạc bình tĩnh (không tư vấn đầu tư sản phẩm)",
    "cham-soc": "chăm sóc người thân và an toàn tại nhà",
  };

  const prompt = `Bạn là chuyên viên tư vấn giáo dục sức khỏe cộng đồng / coach chuẩn bị tuổi già của VivaAge, viết cho người Việt ngoài 40–65 tuổi và người đang chăm sóc cha mẹ lớn tuổi.
Giọng: chuyên nghiệp, ấm, rõ ràng, không hù dọa, không dùng tiếng lóng. Thông tin phải chính xác trong phạm vi giáo dục phổ thông.
Chủ đề: ${themeHint[theme]}.
Tuyệt đối không chẩn đoán bệnh, không kê đơn, không tư vấn đầu tư/pháp lý cá nhân.

Yêu cầu bắt buộc:
- body markdown tiếng Việt, tối thiểu ${BLOG_MIN_WORDS} từ (đếm theo khoảng trắng), khuyến nghị 450–700 từ
- có ít nhất 3 mục ## 
- nêu rõ giới hạn của bài (khi nào cần gặp bác sĩ / cơ quan có thẩm quyền)
- chèn ít nhất 2 liên kết nội bộ markdown trong body, chọn từ:
  [đánh giá sẵn sàng](/danh-gia), [kế hoạch 30 ngày](/ke-hoach), [thư viện](/thu-vien), [Hỏi VivaAge](/hoi), [Góc động viên](/blog)
- chọn 1–3 sourceIds CHỈ từ danh sách sau:
${allowlistForPrompt(theme)}

Trả về ĐÚNG một JSON (không markdown ngoài JSON):
{"title":"...","excerpt":"1-2 câu","minutes":8,"sourceIds":["..."],"body":"markdown"}`;

  try {
    const response = await runWorkersAi(env, WORKERS_AI_TEXT_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Chỉ trả JSON hợp lệ. Tiếng Việt tự nhiên, chính xác, góc nhìn tư vấn giáo dục người lớn tuổi.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      max_tokens: 3200,
    });
    const read = readWorkersAiText(response);
    if (!read.ok) {
      logBlogAiFailure(read.error);
      return null;
    }
    const parsed = parseJsonObject(read.text);
    if (!parsed) return null;
    const title = String(parsed.title ?? "").trim();
    const excerpt = String(parsed.excerpt ?? "").trim();
    let body = String(parsed.body ?? "").trim();
    const minutes = Math.min(
      14,
      Math.max(7, Number(parsed.minutes) || 9),
    );
    const rawIds = Array.isArray(parsed.sourceIds)
      ? parsed.sourceIds.map((x) => String(x))
      : defaultSourceIdsForTheme(theme);
    let sourceIds = resolveBlogSources(rawIds).map((s) => s.id);
    if (sourceIds.length === 0) {
      sourceIds = defaultSourceIdsForTheme(theme);
    }

    if (title.length < 12 || excerpt.length < 20) return null;
    if (countBlogWords(body) < BLOG_MIN_WORDS) {
      // Soft pad with structured closer rather than publishing a thin post.
      body = `${body}

## Việc nhỏ bạn có thể làm tuần này

1. Chọn **một** việc vừa sức liên quan chủ đề bài viết và làm trong 20 phút.
2. Ghi lại cảm giác sau khi làm — não bộ cần bằng chứng tiến bộ.
3. Nếu còn băn khoăn chuyên môn, hãy dùng [Hỏi VivaAge](/hoi) (có nguồn) hoặc đặt lịch với bác sĩ / cơ quan có thẩm quyền.

Bạn cũng có thể [kiểm tra mức độ sẵn sàng](/danh-gia) hoặc xem [kế hoạch 30 ngày](/ke-hoach) để biến ý tưởng thành việc nhỏ đều đặn.`;
    }
    if (countBlogWords(body) < BLOG_MIN_WORDS) return null;

    const slug = slugifyTitle(title, isoDate, slot);
    const cover = await generateAndStoreBlogCover(env, slug, title, theme);

    return {
      slug,
      title,
      excerpt,
      theme,
      minutes,
      sourceIds,
      body: `${body.trim()}${DISCLAIMER}`,
      coverImageKey: cover?.key ?? null,
      coverAlt: cover?.alt,
    };
  } catch (err) {
    logBlogAiFailure(formatWorkersAiError(err));
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
  const publishedAt =
    status === "published" ? `${scheduledFor}T02:00:00.000Z` : null;
  const sourcesJson = JSON.stringify(post.sourceIds ?? []);
  try {
    await db
      .prepare(
        `INSERT INTO blog_posts (
          id, slug, title, excerpt, theme, reading_minutes, body_markdown,
          status, scheduled_for, published_at, author_name, created_at, updated_at,
          sources_json, cover_image_key, cover_alt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sourcesJson,
        post.coverImageKey ?? null,
        post.coverAlt ?? null,
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
