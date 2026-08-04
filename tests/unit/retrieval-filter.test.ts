import { describe, expect, it } from "vitest";
import { filterRetrievedCandidates } from "../../worker/ai/retrieval-filter";

describe("retrieval filtering", () => {
  it("excludes superseded and withdrawn sources", () => {
    const filtered = filterRetrievedCandidates([
      {
        score: 0.9,
        content: "ok",
        metadata: { status: "active", review_status: "approved", title: "A" },
      },
      {
        score: 0.95,
        content: "old",
        metadata: { status: "superseded", review_status: "approved", title: "B" },
      },
      {
        score: 0.1,
        content: "low",
        metadata: { status: "active", review_status: "approved", title: "C" },
      },
      {
        score: 0.8,
        content: "pending",
        metadata: { status: "active", review_status: "pending", title: "D" },
      },
    ]);
    expect(filtered.map((f) => f.metadata.title)).toEqual(["A"]);
  });

  it("excludes expired effective_to dates", () => {
    const filtered = filterRetrievedCandidates([
      {
        score: 0.9,
        content: "expired",
        metadata: {
          status: "active",
          review_status: "approved",
          effective_to: "2020-01-01",
          title: "E",
        },
      },
    ]);
    expect(filtered).toHaveLength(0);
  });
});
