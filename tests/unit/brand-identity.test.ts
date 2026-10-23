import { describe, expect, it } from "vitest";
import {
  BRAND,
  INDEXABLE_ROUTES,
  PERSON_ID,
  absoluteUrl,
  pageTitle,
  homeJsonLdGraph,
  faqPageJsonLd,
} from "../../shared/brand";

describe("brand identity", () => {
  it("exposes stable Vietnamese brand fields", () => {
    expect(BRAND.name).toBe("VivaAge");
    expect(BRAND.shortName).toBe("VivaAge");
    expect(BRAND.language).toBe("vi-VN");
    expect(BRAND.country).toBe("VN");
    expect(BRAND.themeColor).toBe("#1f5c45");
    expect(BRAND.tagline).toContain("tự chủ về sau");
  });

  it("builds absolute URLs from site origin", () => {
    expect(absoluteUrl("/")).toBe(`${BRAND.siteUrl}/`);
    expect(absoluteUrl("blog")).toBe(`${BRAND.siteUrl}/blog`);
    expect(absoluteUrl("/hoi")).toBe(`${BRAND.siteUrl}/hoi`);
  });

  it("formats page titles", () => {
    expect(pageTitle()).toContain(BRAND.name);
    expect(pageTitle("Hỏi VivaAge")).toBe(`Hỏi VivaAge | ${BRAND.name}`);
  });

  it("lists indexable marketing routes", () => {
    const paths = INDEXABLE_ROUTES.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/blog");
    expect(paths).toContain("/danh-gia");
  });

  it("emits Organization + FAQ JSON-LD for GEO", () => {
    const graph = homeJsonLdGraph();
    const types = graph["@graph"].map((n) => n["@type"]);
    expect(types).toContain("Person");
    expect(types).toContain("Organization");
    expect(types).toContain("WebApplication");
    expect(types).toContain("FAQPage");
    expect(JSON.stringify(graph)).toContain(`"@id":"${PERSON_ID}"`);

    const faq = faqPageJsonLd();
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    expect(faq.mainEntity[0]?.acceptedAnswer?.text.length).toBeGreaterThan(20);
    expect(faq.mainEntity.some((q) => q.name === "VivaAge là gì?")).toBe(true);
    expect(faq.mainEntity.some((q) => q.name === "What is VivaAge?")).toBe(true);
    const falls = faq.mainEntity.find((q) => q.name === "Làm gì khi cha mẹ bị ngã?");
    expect(falls?.acceptedAnswer.text).toContain("giữ bình tĩnh");
  });
});
