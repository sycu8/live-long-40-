import { describe, expect, it } from "vitest";
import { themeLabel } from "../../worker/api/blog";
import {
  BLOG_CADENCE_DAYS,
  BLOG_SCHEDULE_HORIZON_DAYS,
} from "../../shared/constants/blog";
import bank from "../../shared/content/blog-editorial-bank.json" with { type: "json" };

describe("blog helpers", () => {
  it("maps known themes to Vietnamese labels", () => {
    expect(themeLabel("tinh-than")).toBe("Tinh thần");
    expect(themeLabel("tai-chinh")).toBe("Tiền bạc bình tĩnh");
    expect(themeLabel("unknown-theme")).toBe("unknown-theme");
  });

  it("uses daily cadence and a multi-week schedule horizon", () => {
    expect(BLOG_CADENCE_DAYS).toBe(1);
    expect(BLOG_SCHEDULE_HORIZON_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("ships an editorial bank for the daily scheduler", () => {
    expect(Array.isArray(bank)).toBe(true);
    expect(bank.length).toBeGreaterThanOrEqual(18);
    for (const post of bank) {
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
      expect(post.title.length).toBeGreaterThan(10);
      expect(post.body.length).toBeGreaterThan(100);
    }
    const slugs = new Set(bank.map((p) => p.slug));
    expect(slugs.size).toBe(bank.length);
  });
});
