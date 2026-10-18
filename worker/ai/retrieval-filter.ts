import {
  isEvidenceTrustTier,
  isOfficialIssuer,
  sourceLooksOfficial,
} from "@shared/rules/sources";

/**
 * Floor for AI Search embedding scores only. Lexical ranking uses
 * MIN_RETRIEVAL_SCORE afterwards. 0.42 on this scale dropped real hits.
 */
const EMBEDDING_MIN_SCORE = 0.25;

const MIN_SCORE = EMBEDDING_MIN_SCORE;

export type RetrievalCandidate = {
  score?: number;
  content?: string;
  filename?: string;
  metadata?: Record<string, unknown>;
};

function candidateIsOfficialEvidence(meta: Record<string, unknown>): boolean {
  const trust = meta.trust_tier ? String(meta.trust_tier) : "";
  const issuer = meta.issuer ? String(meta.issuer) : "";
  const url = meta.original_url ? String(meta.original_url) : "";
  if (isEvidenceTrustTier(trust)) return true;
  return sourceLooksOfficial({ issuer, trustTier: trust, url });
}

/** Shared filter used by AI Search results and tests. */
export function filterRetrievedCandidates(
  items: RetrievalCandidate[],
  now = new Date(),
  options: { requireOfficial?: boolean } = { requireOfficial: true },
): RetrievalCandidate[] {
  const today = now.toISOString().slice(0, 10);
  const requireOfficial = options.requireOfficial !== false;
  return items.filter((item) => {
    const meta = item.metadata ?? {};
    const status = String(meta.status ?? "active");
    const review = String(meta.review_status ?? "approved");
    if (status !== "active") return false;
    if (review !== "approved") return false;
    const effectiveTo = meta.effective_to ? String(meta.effective_to) : "";
    if (effectiveTo && effectiveTo < today) return false;
    const score = item.score ?? 0;
    if (score < MIN_SCORE) return false;
    if (requireOfficial && !candidateIsOfficialEvidence(meta)) return false;
    // Prefer entries that still have an issuer string when official patterns apply
    if (
      requireOfficial &&
      meta.issuer &&
      !isOfficialIssuer(String(meta.issuer)) &&
      !isEvidenceTrustTier(String(meta.trust_tier ?? ""))
    ) {
      return false;
    }
    return true;
  });
}

export { MIN_SCORE };
