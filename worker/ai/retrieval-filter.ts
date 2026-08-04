const MIN_SCORE = 0.25;

export type RetrievalCandidate = {
  score?: number;
  content?: string;
  filename?: string;
  metadata?: Record<string, unknown>;
};

/** Shared filter used by AI Search results and tests. */
export function filterRetrievedCandidates(
  items: RetrievalCandidate[],
  now = new Date(),
): RetrievalCandidate[] {
  const today = now.toISOString().slice(0, 10);
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
    return true;
  });
}

export { MIN_SCORE };
