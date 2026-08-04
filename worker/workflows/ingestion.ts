import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { Env } from "../env";
import { createSourceVersionWithChunks } from "../knowledge/ingest";
import { createId, nowIso } from "@shared/utils/id";

type Params = {
  jobId: string;
  sourceId: string;
  reviewedText?: string;
};

export class IngestionWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { jobId, sourceId } = event.payload;

    await step.do("mark-running", async () => {
      await this.env.DB.prepare(
        `UPDATE ingestion_jobs SET status = 'running', started_at = ?, workflow_instance_id = ? WHERE id = ?`,
      )
        .bind(nowIso(), event.instanceId, jobId)
        .run();
    });

    const text = await step.do("load-text", async () => {
      if (event.payload.reviewedText) return event.payload.reviewedText;
      const version = await this.env.DB.prepare(
        `SELECT reviewed_text FROM source_versions WHERE source_id = ? ORDER BY version_number DESC LIMIT 1`,
      )
        .bind(sourceId)
        .first<{ reviewed_text: string | null }>();
      if (version?.reviewed_text) return version.reviewed_text;

      const source = await this.env.DB.prepare(
        `SELECT r2_object_key FROM source_documents WHERE id = ?`,
      )
        .bind(sourceId)
        .first<{ r2_object_key: string | null }>();
      if (!source?.r2_object_key) {
        throw new Error("Không có văn bản đã duyệt hoặc đối tượng R2.");
      }
      if (!this.env.SOURCES) {
        throw new Error("R2 chưa được cấu hình trên môi trường này.");
      }
      const obj = await this.env.SOURCES.get(source.r2_object_key);
      if (!obj) throw new Error("Không đọc được đối tượng R2.");
      const contentType = obj.httpMetadata?.contentType ?? "";
      if (
        contentType.includes("pdf") ||
        source.r2_object_key.toLowerCase().endsWith(".pdf")
      ) {
        throw new Error(
          "PDF gốc đã lưu trên R2 nhưng cần dán văn bản đã duyệt trước khi lập chỉ mục.",
        );
      }
      return await obj.text();
    });

    const version = await step.do("chunk", async () => {
      return await createSourceVersionWithChunks(
        this.env.DB,
        sourceId,
        text,
        "ingestion-workflow",
      );
    });

    await step.do("prepare-index", async () => {
      // Chunks stay pending until explicit admin approval triggers AI Search upload
      await this.env.DB.prepare(
        `UPDATE ingestion_jobs SET version_id = ?, status = 'awaiting_approval', finished_at = ? WHERE id = ?`,
      )
        .bind(version.versionId, nowIso(), jobId)
        .run();
      await this.env.DB.prepare(
        `UPDATE source_documents SET updated_at = ?, content_hash = ? WHERE id = ?`,
      )
        .bind(nowIso(), version.contentHash, sourceId)
        .run();
      return { chunkCount: version.chunkCount };
    });

    await step.do("audit", async () => {
      await this.env.DB.prepare(
        `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, detail_json, created_at)
         VALUES (?, 'system', 'ingestion_completed', 'source_documents', ?, ?, ?)`,
      )
        .bind(
          createId("audit"),
          sourceId,
          JSON.stringify({ jobId, versionId: version.versionId }),
          nowIso(),
        )
        .run();
    });

    return { ok: true, versionId: version.versionId };
  }
}
