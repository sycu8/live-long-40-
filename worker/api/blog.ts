import { Hono } from "hono";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { nowIso } from "@shared/utils/id";

export const blogRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const THEME_LABELS: Record<string, string> = {
  "tinh-than": "Tinh thần",
  "thoi-quen": "Thói quen",
  "cham-soc": "Chăm sóc",
  "tai-chinh": "Tài chính bình tĩnh",
  "suc-khoe": "Sức khỏe dịu dàng",
};

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

/** Publish scheduled posts whose scheduled_for date has arrived. */
export async function publishDueBlogPosts(db: D1Database): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE blog_posts
       SET status = 'published', published_at = ?, updated_at = ?
       WHERE status = 'scheduled' AND scheduled_for <= ?`,
    )
    .bind(now, now, today)
    .run();
  return result.meta?.changes ?? 0;
}

blogRoutes.get("/blog", async (c) => {
  await publishDueBlogPosts(c.env.DB);
  const theme = c.req.query("theme");
  const rows = theme
    ? await c.env.DB.prepare(
        `SELECT slug, title, excerpt, theme, reading_minutes, published_at, author_name
         FROM blog_posts
         WHERE status = 'published' AND theme = ?
         ORDER BY published_at DESC`,
      )
        .bind(theme)
        .all()
    : await c.env.DB.prepare(
        `SELECT slug, title, excerpt, theme, reading_minutes, published_at, author_name
         FROM blog_posts
         WHERE status = 'published'
         ORDER BY published_at DESC`,
      ).all();

  return c.json({
    cadenceDays: 2,
    themes: THEME_LABELS,
    items: (rows.results ?? []).map((row) => ({
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      theme: row.theme,
      themeLabel: themeLabel(String(row.theme)),
      readingMinutes: row.reading_minutes,
      publishedAt: row.published_at,
      authorName: row.author_name,
    })),
  });
});

blogRoutes.get("/blog/:slug", async (c) => {
  await publishDueBlogPosts(c.env.DB);
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT slug, title, excerpt, theme, reading_minutes, body_markdown,
            published_at, author_name, scheduled_for
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
    }>();

  if (!row) {
    return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  }

  const related = await c.env.DB.prepare(
    `SELECT slug, title, excerpt, theme, reading_minutes, published_at
     FROM blog_posts
     WHERE status = 'published' AND theme = ? AND slug != ?
     ORDER BY published_at DESC
     LIMIT 3`,
  )
    .bind(row.theme, slug)
    .all();

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
    },
    related: (related.results ?? []).map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      themeLabel: themeLabel(String(r.theme)),
      readingMinutes: r.reading_minutes,
      publishedAt: r.published_at,
    })),
  });
});
