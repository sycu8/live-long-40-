import { describe, expect, it } from "vitest";
import { themeLabel } from "../../worker/api/blog";
import {
  BLOG_CADENCE_DAYS,
  BLOG_FEATURED_LIMIT,
  BLOG_MIN_WORDS,
  BLOG_PAGE_SIZE_DEFAULT,
  BLOG_PAGE_SIZE_MAX,
  BLOG_PAGE_SIZE_MIN,
  BLOG_POSTS_PER_DAY,
  BLOG_SCHEDULE_HORIZON_DAYS,
  clampBlogPage,
  clampBlogPageSize,
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

  it("clamps blog page size to 6–9 and page to >= 1", () => {
    expect(BLOG_PAGE_SIZE_DEFAULT).toBe(8);
    expect(BLOG_PAGE_SIZE_MIN).toBe(6);
    expect(BLOG_PAGE_SIZE_MAX).toBe(9);
    expect(BLOG_FEATURED_LIMIT).toBe(3);
    expect(clampBlogPageSize(undefined)).toBe(8);
    expect(clampBlogPageSize(3)).toBe(6);
    expect(clampBlogPageSize(12)).toBe(9);
    expect(clampBlogPageSize(7)).toBe(7);
    expect(clampBlogPage(0)).toBe(1);
    expect(clampBlogPage(-2)).toBe(1);
    expect(clampBlogPage("3")).toBe(3);
    expect(clampBlogPage("nope")).toBe(1);
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
    expect(advisorBatch.length).toBe(10);
    const slugs = new Set(advisorBatch.map((p) => p.slug));
    for (const slug of [
      "an-uong-don-gian-tuoi-ngoai-40",
      "bot-ngoi-lau-trong-ngay-lam-viec",
      "ngan-sach-thang-va-tranh-vay-nong",
      "chia-viec-cham-soc-va-lien-he-khan",
    ]) {
      expect(slugs.has(slug)).toBe(true);
    }
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
