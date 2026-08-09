import { describe, expect, it } from "vitest";
import { themeLabel } from "../../worker/api/blog";
import {
  BLOG_CADENCE_DAYS,
  BLOG_MIN_WORDS,
  BLOG_POSTS_PER_DAY,
  BLOG_SCHEDULE_HORIZON_DAYS,
  countBlogWords,
} from "../../shared/constants/blog";
import { resolveBlogSources } from "../../shared/content/blog-theme-sources";
import { isGenericHomepageUrl } from "../../shared/content/official-sources";
import bank from "../../shared/content/blog-editorial-bank.json" with { type: "json" };
import advisorBatch from "../../seed/blog-advisor-batch.json" with { type: "json" };

describe("blog helpers", () => {
  it("maps known themes to Vietnamese labels", () => {
    expect(themeLabel("tinh-than")).toBe("Tinh thần");
    expect(themeLabel("tai-chinh")).toBe("Tiền bạc bình tĩnh");
    expect(themeLabel("unknown-theme")).toBe("unknown-theme");
  });

  it("targets two posts per day with a multi-week horizon", () => {
    expect(BLOG_CADENCE_DAYS).toBe(1);
    expect(BLOG_POSTS_PER_DAY).toBe(2);
    expect(BLOG_SCHEDULE_HORIZON_DAYS).toBeGreaterThanOrEqual(14);
    expect(BLOG_MIN_WORDS).toBe(300);
  });

  it("ships an editorial bank for the daily scheduler", () => {
    expect(Array.isArray(bank)).toBe(true);
    expect(bank.length).toBeGreaterThanOrEqual(24);
    for (const post of bank) {
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
      expect(post.title.length).toBeGreaterThan(10);
      expect(post.body.length).toBeGreaterThan(100);
    }
    const slugs = new Set(bank.map((p) => p.slug));
    expect(slugs.size).toBe(bank.length);
    const intro = bank.find((p) => p.slug === "gioi-thieu-vivaage");
    expect(intro?.title).toMatch(/VivaAge/);
  });

  it("ships advisor batch posts with 300+ words, sources, and internal links", () => {
    expect(advisorBatch.length).toBe(6);
    for (const post of advisorBatch) {
      expect(countBlogWords(post.body)).toBeGreaterThanOrEqual(BLOG_MIN_WORDS);
      expect(Array.isArray(post.sourceIds)).toBe(true);
      expect(post.sourceIds.length).toBeGreaterThanOrEqual(1);
      const sources = resolveBlogSources(post.sourceIds);
      expect(sources.length).toBe(post.sourceIds.length);
      for (const s of sources) {
        expect(isGenericHomepageUrl(s.url)).toBe(false);
      }
      const internalLinks = post.body.match(/\[[^\]]+\]\(\/[^)]+\)/g) ?? [];
      expect(internalLinks.length).toBeGreaterThanOrEqual(2);
    }
  });
});
