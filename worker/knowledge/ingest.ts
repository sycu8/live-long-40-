import { createId, nowIso, sha256Hex } from "@shared/utils/id";

/** Simple semantic-ish chunking by headings and paragraph size. */
export function chunkText(
  text: string,
  opts: { maxChars?: number } = {},
): Array<{ heading: string | null; locationRef: string; content: string }> {
  const maxChars = opts.maxChars ?? 900;
  const normalized = text.normalize("NFC").replace(/\r\n/g, "\n").trim();
  const sections = normalized.split(/\n(?=#{1,3}\s)/);
  const chunks: Array<{ heading: string | null; locationRef: string; content: string }> = [];
  let idx = 0;

  for (const section of sections) {
    const lines = section.split("\n");
    const headingMatch = lines[0]?.match(/^#{1,3}\s+(.+)$/);
    const heading = headingMatch ? headingMatch[1]!.trim() : null;
    const body = headingMatch ? lines.slice(1).join("\n").trim() : section.trim();
    if (!body) continue;

    if (body.length <= maxChars) {
      chunks.push({
        heading,
        locationRef: `chunk-${idx}`,
        content: heading ? `${heading}\n\n${body}` : body,
      });
      idx += 1;
      continue;
    }

    const paragraphs = body.split(/\n{2,}/);
    let buffer = "";
    for (const p of paragraphs) {
      if ((buffer + "\n\n" + p).length > maxChars && buffer) {
        chunks.push({
          heading,
          locationRef: `chunk-${idx}`,
          content: heading ? `${heading}\n\n${buffer}` : buffer,
        });
        idx += 1;
        buffer = p;
      } else {
        buffer = buffer ? `${buffer}\n\n${p}` : p;
      }
    }
    if (buffer) {
      chunks.push({
        heading,
        locationRef: `chunk-${idx}`,
        content: heading ? `${heading}\n\n${buffer}` : buffer,
      });
      idx += 1;
    }
  }

  return chunks;
}

export async function createSourceVersionWithChunks(
  db: D1Database,
  sourceId: string,
  reviewedText: string,
  createdBy: string | null,
) {
  const hash = await sha256Hex(reviewedText);
  const versionCount = await db
    .prepare(`SELECT COUNT(*) as c FROM source_versions WHERE source_id = ?`)
    .bind(sourceId)
    .first<{ c: number }>();
  const versionNumber = (versionCount?.c ?? 0) + 1;
  const versionId = createId("sver");
  await db
    .prepare(
      `INSERT INTO source_versions (id, source_id, version_number, content_hash, reviewed_text, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(versionId, sourceId, versionNumber, hash, reviewedText, nowIso(), createdBy)
    .run();

  const chunks = chunkText(reviewedText);
  const sourceMeta = await db
    .prepare(
      `SELECT title, issuer, jurisdiction, document_type, language, category, pillar, status, review_status,
              publication_date, effective_from, effective_to, original_url, trust_tier
       FROM source_documents WHERE id = ?`,
    )
    .bind(sourceId)
    .first();

  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i]!;
    const contentHash = await sha256Hex(ch.content);
    await db
      .prepare(
        `INSERT INTO source_chunks
         (id, source_id, version_id, chunk_index, heading, location_ref, content, content_hash, metadata_json, indexing_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(
        createId("chk"),
        sourceId,
        versionId,
        i,
        ch.heading,
        ch.locationRef,
        ch.content,
        contentHash,
        JSON.stringify({
          source_id: sourceId,
          title: sourceMeta?.title,
          issuer: sourceMeta?.issuer,
          jurisdiction: sourceMeta?.jurisdiction,
          document_type: sourceMeta?.document_type,
          language: sourceMeta?.language,
          category: sourceMeta?.category,
          pillar: sourceMeta?.pillar,
          status: sourceMeta?.status,
          review_status: sourceMeta?.review_status,
          publication_date: sourceMeta?.publication_date,
          effective_from: sourceMeta?.effective_from,
          effective_to: sourceMeta?.effective_to,
          original_url: sourceMeta?.original_url,
          trust_tier: sourceMeta?.trust_tier ?? "editorial",
        }),
        nowIso(),
      )
      .run();
  }

  return { versionId, chunkCount: chunks.length, contentHash: hash };
}
