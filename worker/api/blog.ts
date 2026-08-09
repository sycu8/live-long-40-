import { Hono } from "hono";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import {
  BLOG_CADENCE_DAYS,
  BLOG_FEATURED_LIMIT,
  BLOG_POSTS_PER_DAY,
  clampBlogPage,
  clampBlogPageSize,
} from "@shared/constants/blog";
import { resolveBlogSources } from "@shared/content/blog-theme-sources";
import { publishDueBlogPosts } from "../blog/schedule";
import { readBlogCover } from "../blog/images";

export { publishDueBlogPosts } from "../blog/schedule";

export const blogRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const THEME_LABELS: Record<string, string> = {
  "tinh-than": "Tinh thần",
  "thoi-quen": "Thói quen",
  "cham-soc": "Chăm sóc",
  "tai-chinh": "Tiền bạc bình tĩnh",
  "suc-khoe": "Sức khỏe dịu dàng",
};

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

function parseSourceIds(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function coverUrlFor(
  key: string | null | undefined,
  slug: string,
): string | null {
  if (!key) return null;
  return `/api/v1/blog/covers/${encodeURIComponent(slug)}`;
}

type ListRow = {
  slug: string;
  title: string;
  excerpt: string;
  theme: string;
  reading_minutes: number;
  published_at: string;
  author_name: string;
  cover_image_key: string | null;
  cover_alt: string | null;
  sources_json: string | null;
  is_featured: number | null;
  featured_rank: number | null;
};

function mapListItem(row: ListRow) {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    theme: row.theme,
    themeLabel: themeLabel(String(row.theme)),
    readingMinutes: row.reading_minutes,
    publishedAt: row.published_at,
    authorName: row.author_name,
    coverImageUrl: coverUrlFor(row.cover_image_key, String(row.slug)),
    coverAlt: row.cover_alt ?? null,
    sourceCount: parseSourceIds(row.sources_json).length,
    featured: Number(row.is_featured) === 1,
    featuredRank: Number(row.featured_rank) || 100,
  };
}

blogRoutes.get("/blog/covers/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT cover_image_key FROM blog_posts WHERE slug = ?`,
  )
    .bind(slug)
    .first<{ cover_image_key: string | null }>();
  if (!row?.cover_image_key) {
    return jsonError(c, 404, "NOT_FOUND", "Không có ảnh minh họa.");
  }
  const obj = await readBlogCover(c.env, row.cover_image_key);
  if (!obj) {
    return jsonError(c, 404, "NOT_FOUND", "Không đọc được ảnh minh họa.");
  }
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "image/png");
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(obj.body, { headers });
});

blogRoutes.get("/blog", async (c) => {
  await publishDueBlogPosts(c.env.DB);
  const theme = c.req.query("theme")?.trim() || "";
  const page = clampBlogPage(c.req.query("page"));
  const pageSize = clampBlogPageSize(c.req.query("pageSize"));

  const where = theme
    ? `status = 'published' AND theme = ?`
    : `status = 'published'`;
  const countSql = `SELECT COUNT(*) AS c FROM blog_posts WHERE ${where}`;
  const countRow = theme
    ? await c.env.DB.prepare(countSql).bind(theme).first<{ c: number }>()
    : await c.env.DB.prepare(countSql).first<{ c: number }>();
  const total = Number(countRow?.c ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const listSql = `
    SELECT slug, title, excerpt, theme, reading_minutes, published_at, author_name,
           cover_image_key, cover_alt, sources_json, is_featured, featured_rank
    FROM blog_posts
    WHERE ${where}
    ORDER BY is_featured DESC, featured_rank ASC, published_at DESC
    LIMIT ? OFFSET ?`;

  const rows = theme
    ? await c.env.DB.prepare(listSql)
        .bind(theme, pageSize, offset)
        .all<ListRow>()
    : await c.env.DB.prepare(listSql).bind(pageSize, offset).all<ListRow>();

  const items = (rows.results ?? []).map(mapListItem);
  // Hero featured block: only page 1, leading featured posts (cap BLOG_FEATURED_LIMIT).
  const featured =
    safePage === 1
      ? items.filter((i) => i.featured).slice(0, BLOG_FEATURED_LIMIT)
      : [];
  const rest =
    safePage === 1
      ? items.filter((i) => !featured.some((f) => f.slug === i.slug))
      : items;

  return c.json({
    cadenceDays: BLOG_CADENCE_DAYS,
    postsPerDay: BLOG_POSTS_PER_DAY,
    themes: THEME_LABELS,
    page: safePage,
    pageSize,
    total,
    totalPages,
    featured,
    items: rest,
  });
});

blogRoutes.get("/blog/:slug", async (c) => {
  await publishDueBlogPosts(c.env.DB);
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT slug, title, excerpt, theme, reading_minutes, body_markdown,
            published_at, author_name, scheduled_for, sources_json,
            cover_image_key, cover_alt, is_featured, featured_rank
     FROM blog_posts
     WHERE slug = ? AND status = 'published'`,
  )
    .bind(slug)
    .first<{
      slug: string;
      title: string;
      excerpt: string;
      theme: string;
      reading_minutes: number;
      body_markdown: string;
      published_at: string;
      author_name: string;
      sources_json: string | null;
      cover_image_key: string | null;
      cover_alt: string | null;
      is_featured: number | null;
      featured_rank: number | null;
    }>();

  if (!row) {
    return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  }

  const related = await c.env.DB.prepare(
    `SELECT slug, title, excerpt, theme, reading_minutes, published_at, cover_image_key,
            is_featured, featured_rank
     FROM blog_posts
     WHERE status = 'published' AND theme = ? AND slug != ?
     ORDER BY is_featured DESC, featured_rank ASC, published_at DESC
     LIMIT 4`,
  )
    .bind(row.theme, slug)
    .all();

  const sources = resolveBlogSources(parseSourceIds(row.sources_json)).map(
    (s) => ({
      id: s.id,
      title: s.title,
      issuer: s.issuer,
      url: s.url,
      publicationDate: s.publicationDate,
      snippet: s.snippet,
      trustTier: s.trustTier,
    }),
  );

  return c.json({
    item: {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      theme: row.theme,
      themeLabel: themeLabel(row.theme),
      readingMinutes: row.reading_minutes,
      bodyMarkdown: row.body_markdown,
      publishedAt: row.published_at,
      authorName: row.author_name,
      coverImageUrl: coverUrlFor(row.cover_image_key, row.slug),
      coverAlt: row.cover_alt,
      sources,
      featured: Number(row.is_featured) === 1,
    },
    related: (related.results ?? []).map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      themeLabel: themeLabel(String(r.theme)),
      readingMinutes: r.reading_minutes,
      publishedAt: r.published_at,
      coverImageUrl: coverUrlFor(
        r.cover_image_key as string | null,
        String(r.slug),
      ),
      featured: Number(r.is_featured) === 1,
    })),
    backlinks: themeBacklinks(row.theme),
  });
});

function themeBacklinks(theme: string) {
  const common = [
    { to: "/danh-gia", label: "Kiểm tra mức độ sẵn sàng" },
    { to: "/ke-hoach", label: "Xem kế hoạch 30 ngày" },
    { to: "/hoi", label: "Hỏi VivaAge (có nguồn)" },
    { to: "/blog", label: "Tất cả bài Góc động viên" },
  ];
  const byTheme: Record<string, { to: string; label: string }> = {
    "suc-khoe": {
      to: "/thu-vien?category=suc-khoe-trung-nien",
      label: "Thư viện: sức khỏe trung niên",
    },
    "tai-chinh": {
      to: "/thu-vien?category=chuan-bi-tai-chinh",
      label: "Thư viện: chuẩn bị tài chính",
    },
    "cham-soc": {
      to: "/thu-vien?category=cham-soc-cha-me",
      label: "Thư viện: chăm sóc người thân",
    },
    "tinh-than": {
      to: "/thu-vien?category=tri-nho-tinh-than",
      label: "Thư viện: trí nhớ & tinh thần",
    },
    "thoi-quen": {
      to: "/thu-vien",
      label: "Thư viện bài học ngắn",
    },
  };
  const extra = byTheme[theme];
  return extra ? [extra, ...common] : common;
}
