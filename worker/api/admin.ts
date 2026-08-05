import { Hono } from "hono";
import {
  AdminSourceCreateSchema,
  AdminIngestSchema,
  AdminApproveSchema,
} from "@shared/schemas/api";
import { createId, nowIso, sha256Hex } from "@shared/utils/id";
import { BLOG_CADENCE_DAYS } from "@shared/constants/blog";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { createSourceVersionWithChunks } from "../knowledge/ingest";
import { runBlogDailyJob, editorialBankSize } from "../blog/schedule";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminRoutes.get("/sources", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT public_id, title, issuer, jurisdiction, document_type, category, status, review_status,
            publication_date, last_reviewed_at, updated_at, trust_tier, original_url
     FROM source_documents ORDER BY updated_at DESC LIMIT 100`,
  ).all();
  return c.json({ sources: rows.results ?? [] });
});

adminRoutes.post("/sources", async (c) => {
  const body = AdminSourceCreateSchema.parse(await c.req.json());
  const id = createId("src");
  const publicId = createId("psrc");
  const slug = body.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const now = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO source_documents
     (id, public_id, slug, title, summary, issuer, jurisdiction, document_type, language, category, pillar,
      estimated_reading_minutes, original_url, status, review_status, publication_date, effective_from, effective_to,
      trust_tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      publicId,
      `${slug}-${publicId.slice(-6)}`,
      body.title,
      body.summary ?? null,
      body.issuer,
      body.jurisdiction,
      body.documentType,
      body.language,
      body.category,
      body.pillar ?? null,
      body.estimatedReadingMinutes ?? null,
      body.originalUrl ?? null,
      body.publicationDate ?? null,
      body.effectiveFrom ?? null,
      body.effectiveTo ?? null,
      body.trustTier,
      now,
      now,
    )
    .run();

  if (body.reviewedText) {
    await createSourceVersionWithChunks(c.env.DB, id, body.reviewedText, "admin");
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, 'admin', 'source_created', 'source_documents', ?, ?, ?)`,
  )
    .bind(createId("audit"), id, JSON.stringify({ publicId }), now)
    .run();

  return c.json({ publicId, id });
});

adminRoutes.post("/sources/:id/upload", async (c) => {
  const publicId = c.req.param("id");
  const source = await c.env.DB.prepare(
    `SELECT id FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > 8_000_000) {
    return jsonError(c, 413, "PAYLOAD_TOO_LARGE", "File quá lớn (tối đa 8MB).");
  }

  if (!c.env.SOURCES) {
    return jsonError(
      c,
      503,
      "BINDING_MISSING",
      "R2 chưa được cấu hình trên môi trường này.",
    );
  }

  const key = `sources/${source.id}/${createId("obj")}`;
  await c.env.SOURCES.put(key, buf, {
    httpMetadata: { contentType },
  });
  const hash = await sha256Hex(
    [...new Uint8Array(buf)].map((b) => String.fromCharCode(b)).join(""),
  );

  await c.env.DB.prepare(
    `UPDATE source_documents SET r2_object_key = ?, content_hash = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(key, hash, nowIso(), source.id)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, 'admin', 'source_uploaded', 'source_documents', ?, ?, ?)`,
  )
    .bind(createId("audit"), source.id, JSON.stringify({ key, contentType }), nowIso())
    .run();

  return c.json({
    uploaded: true,
    r2ObjectKey: key,
    note:
      contentType.includes("pdf")
        ? "PDF đã lưu trên R2. Cần dán văn bản đã duyệt trước khi lập chỉ mục."
        : "Đã tải lên R2.",
  });
});

adminRoutes.post("/sources/:id/ingest", async (c) => {
  const publicId = c.req.param("id");
  const body = AdminIngestSchema.parse(await c.req.json().catch(() => ({})));
  const source = await c.env.DB.prepare(
    `SELECT id FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  const jobId = createId("job");
  const jobPublicId = createId("pjob");
  await c.env.DB.prepare(
    `INSERT INTO ingestion_jobs (id, public_id, source_id, status, created_at)
     VALUES (?, ?, ?, 'queued', ?)`,
  )
    .bind(jobId, jobPublicId, source.id, nowIso())
    .run();

  try {
    await c.env.INGESTION_QUEUE?.send({
      type: "ingest",
      jobId,
      sourceId: source.id,
      reviewedText: body.reviewedText,
    });
  } catch {
    // Queue may be unavailable locally — start workflow directly
  }

  try {
    if (!c.env.INGESTION_WORKFLOW) throw new Error("workflow unavailable");
    const instance = await c.env.INGESTION_WORKFLOW.create({
      id: jobPublicId,
      params: {
        jobId,
        sourceId: source.id,
        reviewedText: body.reviewedText,
      },
    });
    await c.env.DB.prepare(
      `UPDATE ingestion_jobs SET workflow_instance_id = ? WHERE id = ?`,
    )
      .bind(instance.id, jobId)
      .run();
  } catch {
    // Local fallback: run chunking synchronously
    if (body.reviewedText) {
      const version = await createSourceVersionWithChunks(
        c.env.DB,
        source.id,
        body.reviewedText,
        "admin-local",
      );
      await c.env.DB.prepare(
        `UPDATE ingestion_jobs SET status = 'awaiting_approval', version_id = ?, finished_at = ? WHERE id = ?`,
      )
        .bind(version.versionId, nowIso(), jobId)
        .run();
    } else {
      await c.env.DB.prepare(
        `UPDATE ingestion_jobs SET status = 'failed', error_message = ?, finished_at = ? WHERE id = ?`,
      )
        .bind(
          "Workflow/Queue không khả dụng và thiếu reviewedText.",
          nowIso(),
          jobId,
        )
        .run();
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, 'admin', 'ingestion_started', 'source_documents', ?, ?, ?)`,
  )
    .bind(createId("audit"), source.id, JSON.stringify({ jobPublicId }), nowIso())
    .run();

  return c.json({ jobPublicId });
});

adminRoutes.post("/sources/:id/approve", async (c) => {
  const publicId = c.req.param("id");
  const body = AdminApproveSchema.parse(await c.req.json());
  const source = await c.env.DB.prepare(
    `SELECT id, title, issuer FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string; title: string; issuer: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  if (!body.approve) {
    await c.env.DB.prepare(
      `UPDATE source_documents SET review_status = 'rejected', updated_at = ? WHERE id = ?`,
    )
      .bind(nowIso(), source.id)
      .run();
    await c.env.DB.prepare(
      `UPDATE source_chunks SET indexing_status = 'rejected' WHERE source_id = ? AND indexing_status = 'pending'`,
    )
      .bind(source.id)
      .run();
    return c.json({ approved: false });
  }

  await c.env.DB.prepare(
    `UPDATE source_documents
     SET status = 'active', review_status = 'approved', reviewer = ?, last_reviewed_at = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(body.reviewer, nowIso(), nowIso(), source.id)
    .run();

  const chunks = await c.env.DB.prepare(
    `SELECT id, content, metadata_json, chunk_index FROM source_chunks
     WHERE source_id = ? AND indexing_status IN ('pending', 'approved')
     ORDER BY chunk_index`,
  )
    .bind(source.id)
    .all<{ id: string; content: string; metadata_json: string; chunk_index: number }>();

  let indexed = 0;
  for (const chunk of chunks.results ?? []) {
    const meta = JSON.parse(chunk.metadata_json) as Record<string, string>;
    meta.status = "active";
    meta.review_status = "approved";
    meta.chunk_id = chunk.id;
    meta.source_id = source.id;

    let aiSearchItemId: string | null = null;
    if (c.env.AI_SEARCH && c.env.AI_SEARCH_INSTANCE) {
      try {
        const instance = c.env.AI_SEARCH.get(c.env.AI_SEARCH_INSTANCE);
        const item = await instance.items.upload(
          `${source.id}-${chunk.chunk_index}.md`,
          chunk.content,
          {
            metadata: Object.fromEntries(
              Object.entries(meta).map(([k, v]) => [k, String(v ?? "")]),
            ),
          },
        );
        aiSearchItemId = item.id;
      } catch {
        // Local: mark indexed in D1 for fallback retrieval
      }
    }

    await c.env.DB.prepare(
      `UPDATE source_chunks
       SET indexing_status = 'indexed', ai_search_item_id = ?, metadata_json = ?
       WHERE id = ?`,
    )
      .bind(aiSearchItemId, JSON.stringify(meta), chunk.id)
      .run();
    indexed += 1;
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, 'source_approved', 'source_documents', ?, ?, ?)`,
  )
    .bind(
      createId("audit"),
      body.reviewer,
      source.id,
      JSON.stringify({ indexed }),
      nowIso(),
    )
    .run();

  return c.json({ approved: true, indexed });
});

adminRoutes.post("/sources/:id/withdraw", async (c) => {
  const publicId = c.req.param("id");
  const source = await c.env.DB.prepare(
    `SELECT id FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  await c.env.DB.prepare(
    `UPDATE source_documents SET status = 'withdrawn', updated_at = ? WHERE id = ?`,
  )
    .bind(nowIso(), source.id)
    .run();
  await c.env.DB.prepare(
    `UPDATE source_chunks SET indexing_status = 'withdrawn' WHERE source_id = ?`,
  )
    .bind(source.id)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, 'admin', 'source_withdrawn', 'source_documents', ?, '{}', ?)`,
  )
    .bind(createId("audit"), source.id, nowIso())
    .run();

  return c.json({ withdrawn: true });
});

adminRoutes.get("/sources/:id/chunks", async (c) => {
  const publicId = c.req.param("id");
  const source = await c.env.DB.prepare(
    `SELECT id FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  const chunks = await c.env.DB.prepare(
    `SELECT id, chunk_index, heading, location_ref, substr(content, 1, 280) as preview, indexing_status
     FROM source_chunks WHERE source_id = ? ORDER BY chunk_index`,
  )
    .bind(source.id)
    .all();

  return c.json({ chunks: chunks.results ?? [] });
});

adminRoutes.get("/ingestion-jobs", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT j.public_id, j.status, j.error_message, j.created_at, j.finished_at, s.public_id as source_public_id, s.title
     FROM ingestion_jobs j
     JOIN source_documents s ON s.id = j.source_id
     ORDER BY j.created_at DESC LIMIT 50`,
  ).all();
  return c.json({ jobs: rows.results ?? [] });
});

adminRoutes.get("/sources/:id/usage", async (c) => {
  const publicId = c.req.param("id");
  const source = await c.env.DB.prepare(
    `SELECT id FROM source_documents WHERE public_id = ?`,
  )
    .bind(publicId)
    .first<{ id: string }>();
  if (!source) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy nguồn.");

  const usage = await c.env.DB.prepare(
    `SELECT COUNT(*) as citation_count FROM chat_citations WHERE source_id = ?`,
  )
    .bind(source.id)
    .first<{ citation_count: number }>();

  return c.json({ citationCount: usage?.citation_count ?? 0 });
});

/** Manually run the daily blog publish + schedule fill (same as cron). */
adminRoutes.post("/blog/run-schedule", async (c) => {
  const result = await runBlogDailyJob(c.env);
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, 'admin', 'blog_run_schedule', 'blog_posts', 'schedule', ?, ?)`,
  )
    .bind(createId("audit"), JSON.stringify(result), now)
    .run();
  return c.json({ ok: true, bankSize: editorialBankSize(), ...result });
});

adminRoutes.get("/blog/schedule", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT slug, title, status, scheduled_for, published_at, theme
     FROM blog_posts
     WHERE status IN ('scheduled', 'published')
     ORDER BY scheduled_for DESC
     LIMIT 60`,
  ).all();
  return c.json({
    cadenceDays: BLOG_CADENCE_DAYS,
    items: rows.results ?? [],
  });
});
