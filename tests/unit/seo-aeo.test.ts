import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HUB_SITE,
  PERSON_ID,
  SHORT_ANSWERS,
  SIBLING_SITES,
  canonicalHostname,
  faqPageJsonLd,
  homeJsonLdGraph,
  htmlCanonicalRedirect,
  robotsTagForHost,
} from "../../shared/brand";

const LIVE_URL = "https://vivaage.orangecloud.vn";
const WORKERS_DEV = "https://song-an-40.sycu-lee.workers.dev";

describe("SEO / AEO", () => {
  it("uses the custom domain as the canonical origin", () => {
    expect(canonicalHostname()).toBe("vivaage.orangecloud.vn");
    expect(robotsTagForHost("vivaage.orangecloud.vn")).toBeNull();
    expect(robotsTagForHost("VivaAge.orangecloud.vn.")).toBeNull();
    expect(robotsTagForHost("song-an-40.sycu-lee.workers.dev")).toBe("noindex, nofollow");
    expect(robotsTagForHost("song-an-40.preview.workers.dev")).toBe("noindex, nofollow");
    expect(robotsTagForHost("localhost")).toBe("noindex, nofollow");
  });

  it("301s GET HTML from workers.dev and preview hosts, and leaves API in place", () => {
    expect(
      htmlCanonicalRedirect({
        method: "GET",
        requestUrl: `${WORKERS_DEV}/hoi?tu=40`,
        accept: "text/html",
      }),
    ).toBe(`${LIVE_URL}/hoi?tu=40`);
    expect(
      htmlCanonicalRedirect({
        method: "HEAD",
        requestUrl: "https://feat-seo.song-an-40.workers.dev/blog/mot-bai",
      }),
    ).toBe(`${LIVE_URL}/blog/mot-bai`);
    expect(
      htmlCanonicalRedirect({
        method: "GET",
        requestUrl: `${WORKERS_DEV}/api/v1/meta`,
        accept: "application/json",
      }),
    ).toBeNull();
    expect(
      htmlCanonicalRedirect({
        method: "POST",
        requestUrl: `${WORKERS_DEV}/api/v1/session`,
      }),
    ).toBeNull();
    expect(
      htmlCanonicalRedirect({
        method: "GET",
        requestUrl: `${WORKERS_DEV}/sitemap.xml`,
      }),
    ).toBeNull();
    expect(
      htmlCanonicalRedirect({
        method: "GET",
        requestUrl: `${LIVE_URL}/`,
        accept: "text/html",
      }),
    ).toBeNull();
    expect(
      htmlCanonicalRedirect({
        method: "GET",
        requestUrl: "http://127.0.0.1:5173/",
        accept: "text/html",
      }),
    ).toBeNull();
  });

  it("publishes short answers in Vietnamese and English", () => {
    const faq = faqPageJsonLd();
    for (const item of SHORT_ANSWERS) {
      const vi = faq.mainEntity.find((q) => q.name === item.questionVi);
      const en = faq.mainEntity.find((q) => q.name === item.questionEn);
      expect(vi?.acceptedAnswer.text).toBe(item.answerVi);
      expect(en?.acceptedAnswer.text).toBe(item.answerEn);
      expect(vi?.inLanguage).toBe("vi");
      expect(en?.inLanguage).toBe("en");
    }
  });

  it("points the homepage shell at the live URL, person, and sibling sites", () => {
    const html = readFileSync(resolve("index.html"), "utf8");
    const readme = readFileSync(resolve("README.md"), "utf8");
    const wrangler = readFileSync(resolve("wrangler.jsonc"), "utf8");

    expect(html).toContain("<title>VivaAge | Chuẩn bị hôm nay, tự chủ về sau</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain(`rel="canonical" href="${LIVE_URL}/"`);
    expect(html).toContain(`hreflang="vi-VN" href="${LIVE_URL}/"`);
    expect(html).toContain(`hreflang="x-default" href="${LIVE_URL}/"`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain(`property="og:url" content="${LIVE_URL}/"`);
    expect(html).toContain('property="og:image"');
    expect(html).toContain('"@type": "FAQPage"');
    expect(html).toContain(`"url": "${LIVE_URL}/"`);
    expect(html).toContain(PERSON_ID);
    expect(html).toContain(HUB_SITE.href);

    for (const item of SHORT_ANSWERS) {
      expect(html).toContain(item.questionVi);
      expect(html).toContain(item.answerVi);
      expect(html).toContain(item.questionEn);
      expect(html).toContain(item.answerEn);
    }
    for (const site of SIBLING_SITES) {
      expect(html).toContain(`href="${site.href}"`);
    }

    expect(readme).toContain(`[${LIVE_URL}](${LIVE_URL})`);
    expect(wrangler).toMatch(/"workers_dev":\s*true/);
    expect(wrangler).toContain(`"PUBLIC_SITE_URL": "${LIVE_URL}"`);
    expect(wrangler).toContain('"pattern": "vivaage.orangecloud.vn"');
    expect(wrangler).toContain('"custom_domain": true');

    const graph = JSON.stringify(homeJsonLdGraph());
    expect(graph).toContain(`${LIVE_URL}/`);
    expect(graph).not.toContain("workers.dev");
  });
});
