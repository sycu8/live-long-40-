import { describe, expect, it } from "vitest";
import { filterRetrievedCandidates } from "../../worker/ai/retrieval-filter";

const officialMeta = {
  status: "active",
  review_status: "approved",
  trust_tier: "official_vn",
  issuer: "Bộ Y tế Việt Nam",
  original_url: "https://moh.gov.vn/hoat-dong-cua-dia-phuong/-/asset_publisher/gHbla8vOQDuS/content/trung-binh-nguoi-cao-tuoi-o-viet-nam-mac-nhieu-benh-ket-hop-chi-phi-ieu-tri-cao-gap-8-10-lan-nguoi-tre",
};

describe("retrieval filtering", () => {
  it("excludes superseded and withdrawn sources", () => {
    const filtered = filterRetrievedCandidates([
      {
        score: 0.9,
        content: "ok",
        metadata: { ...officialMeta, title: "A" },
      },
      {
        score: 0.95,
        content: "old",
        metadata: {
          ...officialMeta,
          status: "superseded",
          title: "B",
        },
      },
      {
        score: 0.1,
        content: "low",
        metadata: { ...officialMeta, title: "C" },
      },
      {
        score: 0.8,
        content: "pending",
        metadata: {
          ...officialMeta,
          review_status: "pending",
          title: "D",
        },
      },
    ]);
    expect(filtered.map((f) => f.metadata?.title)).toEqual(["A"]);
  });

  it("excludes expired effective_to dates", () => {
    const filtered = filterRetrievedCandidates([
      {
        score: 0.9,
        content: "expired",
        metadata: {
          ...officialMeta,
          effective_to: "2020-01-01",
          title: "E",
        },
      },
    ]);
    expect(filtered).toHaveLength(0);
  });

  it("excludes editorial sources when requireOfficial", () => {
    const filtered = filterRetrievedCandidates([
      {
        score: 0.9,
        content: "editorial",
        metadata: {
          status: "active",
          review_status: "approved",
          trust_tier: "editorial",
          issuer: "VivaAge Biên tập giáo dục",
          title: "Ed",
        },
      },
      {
        score: 0.85,
        content: "who",
        metadata: {
          status: "active",
          review_status: "approved",
          trust_tier: "intl_guideline",
          issuer: "Tổ chức Y tế Thế giới (WHO)",
          original_url: "https://www.who.int/",
          title: "WHO",
        },
      },
    ]);
    expect(filtered.map((f) => f.metadata?.title)).toEqual(["WHO"]);
  });
});
