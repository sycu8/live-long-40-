import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseLlmsTxt(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  expect(nonEmpty[0]).toMatch(/^# .+/);
  expect(nonEmpty[1]).toMatch(/^> .+/);

  const h2 = lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
  const linkItems = lines.filter((l) => /^- \[[^\]]+\]\([^)]+\)/.test(l));
  return { h2, linkItems, lines };
}

describe("llms.txt format (llmstxt.org)", () => {
  it("follows H1, blockquote, then H2 link-list sections", () => {
    const text = readFileSync(resolve("public/llms.txt"), "utf8");
    const { h2, linkItems } = parseLlmsTxt(text);

    expect(h2.length).toBeGreaterThanOrEqual(2);
    expect(h2).toContain("Docs");
    expect(h2).toContain("Product");
    expect(h2).toContain("Optional");
    expect(linkItems.length).toBeGreaterThanOrEqual(8);

    for (const item of linkItems) {
      expect(item).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\): .+/);
    }

    // No plain "Label: https://..." bullets (non-compliant link lists)
    expect(text).not.toMatch(/^- [^[\n]+: https:\/\//m);
  });

  it("ships llms-full.txt with absolute markdown links", () => {
    const text = readFileSync(resolve("public/llms-full.txt"), "utf8");
    const { linkItems } = parseLlmsTxt(text);
    expect(linkItems.length).toBeGreaterThan(10);
    expect(text).toContain("## Optional");
    expect(linkItems.some((l) => l.includes("/llms.txt"))).toBe(true);
  });
});
