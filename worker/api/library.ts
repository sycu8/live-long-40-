import { Hono } from "hono";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { LIBRARY_CATEGORIES } from "@shared/constants/product";

export const libraryRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

libraryRoutes.get("/library", async (c) => {
  const category = c.req.query("category");
  let sql = `SELECT l.slug, l.title, l.summary, l.category, l.pillar, l.issuer, l.publication_date,
                    l.last_reviewed_at, l.status, l.estimated_reading_minutes,
                    s.title as source_title, s.issuer as source_issuer, s.original_url as source_url,
                    s.trust_tier as source_trust_tier, s.publication_date as source_publication_date
             FROM library_lessons l
             LEFT JOIN source_documents s ON s.id = l.source_document_id
             WHERE l.status = 'active'`;
  const binds: string[] = [];
  if (category) {
    sql += ` AND l.category = ?`;
    binds.push(category);
  }
  sql += ` ORDER BY l.category, l.title`;

  const stmt = c.env.DB.prepare(sql);
  const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

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
      source: r.source_title
        ? {
            title: r.source_title,
            issuer: r.source_issuer,
            url: r.source_url,
            trustTier: r.source_trust_tier,
            publicationDate: r.source_publication_date,
          }
        : null,
    })),
  });
});

libraryRoutes.get("/library/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT l.slug, l.title, l.summary, l.category, l.pillar, l.issuer, l.publication_date,
            l.last_reviewed_at, l.status, l.estimated_reading_minutes, l.body_markdown,
            s.title as source_title, s.issuer as source_issuer, s.original_url as source_url,
            s.trust_tier as source_trust_tier, s.publication_date as source_publication_date,
            s.summary as source_summary
     FROM library_lessons l
     LEFT JOIN source_documents s ON s.id = l.source_document_id
     WHERE l.slug = ? AND l.status = 'active'`,
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
      source: row.source_title
        ? {
            title: row.source_title,
            issuer: row.source_issuer,
            url: row.source_url,
            trustTier: row.source_trust_tier,
            publicationDate: row.source_publication_date,
            summary: row.source_summary,
          }
        : null,
    },
  });
});
