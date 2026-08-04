import { Hono } from "hono";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { LIBRARY_CATEGORIES } from "@shared/constants/product";

export const libraryRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

libraryRoutes.get("/library", async (c) => {
  const category = c.req.query("category");
  let sql = `SELECT slug, title, summary, category, pillar, issuer, publication_date, last_reviewed_at,
                    status, estimated_reading_minutes
             FROM library_lessons WHERE status = 'active'`;
  const binds: string[] = [];
  if (category) {
    sql += ` AND category = ?`;
    binds.push(category);
  }
  sql += ` ORDER BY category, title`;

  const stmt = c.env.DB.prepare(sql);
  const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

  // Cacheable public metadata — allow short public cache on this response only
  c.header("Cache-Control", "public, max-age=60");

  return c.json({
    categories: LIBRARY_CATEGORIES,
    items: (rows.results ?? []).map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      pillar: r.pillar,
      issuer: r.issuer,
      publicationDate: r.publication_date,
      lastReviewedAt: r.last_reviewed_at,
      status: r.status,
      estimatedReadingMinutes: r.estimated_reading_minutes,
    })),
  });
});

libraryRoutes.get("/library/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT slug, title, summary, category, pillar, issuer, publication_date, last_reviewed_at,
            status, estimated_reading_minutes, body_markdown
     FROM library_lessons WHERE slug = ? AND status = 'active'`,
  )
    .bind(slug)
    .first();

  if (!row) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy bài học.");

  c.header("Cache-Control", "public, max-age=120");

  return c.json({
    item: {
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      category: row.category,
      pillar: row.pillar,
      issuer: row.issuer,
      publicationDate: row.publication_date,
      lastReviewedAt: row.last_reviewed_at,
      status: row.status,
      estimatedReadingMinutes: row.estimated_reading_minutes,
      bodyMarkdown: row.body_markdown,
    },
  });
});
