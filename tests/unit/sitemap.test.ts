import { describe, expect, it } from "vitest";
import {
  buildSitemapUrls,
  renderSitemapXml,
  xmlEscape,
} from "../../worker/seo/crawl";
import { INDEXABLE_ROUTES } from "../../shared/brand";

describe("sitemap.xml builder", () => {
  it("escapes XML special characters", () => {
    expect(xmlEscape(`A & B <C> "q" 's'`)).toBe(
      "A &amp; B &lt;C&gt; &quot;q&quot; &apos;s&apos;",
    );
  });

  it("includes indexable routes, library lessons, and blog posts", () => {
    const urls = buildSitemapUrls({
      today: "2026-08-05",
      libraryLessons: [
        { slug: "quy-du-phong", updated_at: "2026-07-01T00:00:00Z" },
        { slug: "phong-nga", last_reviewed_at: "2026-06-15" },
      ],
      blogPosts: [
        {
          slug: "viec-nho-thang-lon",
          published_at: "2026-08-01T12:00:00Z",
        },
      ],
    });

    const paths = urls.map((u) => u.path);
    for (const route of INDEXABLE_ROUTES) {
      expect(paths).toContain(route.path);
    }
    expect(paths).toContain("/thu-vien/quy-du-phong");
    expect(paths).toContain("/thu-vien/phong-nga");
    expect(paths).toContain("/blog/viec-nho-thang-lon");

    const lesson = urls.find((u) => u.path === "/thu-vien/quy-du-phong");
    expect(lesson?.lastmod).toBe("2026-07-01");
    expect(lesson?.priority).toBe("0.75");
  });

  it("renders a valid urlset with hreflang alternates", () => {
    const xml = renderSitemapXml("https://example.com", [
      {
        path: "/",
        lastmod: "2026-08-05",
        changefreq: "weekly",
        priority: "1.0",
      },
      {
        path: "/thu-vien/quy-du-phong",
        lastmod: "2026-07-01",
        changefreq: "monthly",
        priority: "0.75",
      },
    ]);

    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain(
      "<loc>https://example.com/thu-vien/quy-du-phong</loc>",
    );
    expect(xml).toContain('hreflang="vi-VN"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).not.toContain("undefined");
  });
});
