import { Hono } from "hono";
import {
  BLOG_CADENCE_DAYS,
  DEFAULT_PUBLIC_SITE_URL,
} from "@shared/constants/blog";
import type { Env, AppVariables } from "../env";
import { themeLabel } from "../api/blog";
import { publishDueBlogPosts } from "../blog/schedule";

export const crawlRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function siteUrl(env: Env, requestUrl: string): string {
  const fromEnv = (env as Env & { PUBLIC_SITE_URL?: string }).PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    return new URL(requestUrl).origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

type BlogRow = {
  slug: string;
  title: string;
  excerpt: string;
  theme: string;
  reading_minutes: number;
  body_markdown: string;
  published_at: string;
  author_name: string;
  updated_at: string;
};

async function publishedPosts(db: D1Database): Promise<BlogRow[]> {
  await publishDueBlogPosts(db);
  const rows = await db
    .prepare(
      `SELECT slug, title, excerpt, theme, reading_minutes, body_markdown,
              published_at, author_name, updated_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY published_at DESC`,
    )
    .all<BlogRow>();
  return rows.results ?? [];
}

const STATIC_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/hom-nay", changefreq: "weekly", priority: "0.8" },
  { path: "/danh-gia", changefreq: "monthly", priority: "0.9" },
  { path: "/ke-hoach", changefreq: "weekly", priority: "0.8" },
  { path: "/hoi", changefreq: "weekly", priority: "0.9" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/thu-vien", changefreq: "weekly", priority: "0.85" },
  { path: "/ho-so", changefreq: "monthly", priority: "0.5" },
];

crawlRoutes.get("/robots.txt", (c) => {
  const base = siteUrl(c.env, c.req.url);
  const body = `# VivaAge — ${base}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /ket-qua

User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: ChatGPT-User
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Google-Extended
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: anthropic-ai
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: ClaudeBot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Bytespider
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
  return c.text(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

crawlRoutes.get("/sitemap.xml", async (c) => {
  const base = siteUrl(c.env, c.req.url);
  const posts = await publishedPosts(c.env.DB);
  const today = new Date().toISOString().slice(0, 10);

  const urls: string[] = [];
  for (const route of STATIC_PATHS) {
    const loc = `${base}${route.path === "/" ? "/" : route.path}`;
    urls.push(`  <url>
    <loc>${xmlEscape(loc)}</loc>
    <xhtml:link rel="alternate" hreflang="vi-VN" href="${xmlEscape(loc)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}"/>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`);
  }

  for (const post of posts) {
    const loc = `${base}/blog/${post.slug}`;
    const lastmod = (post.published_at || post.updated_at || today).slice(0, 10);
    urls.push(`  <url>
    <loc>${xmlEscape(loc)}</loc>
    <xhtml:link rel="alternate" hreflang="vi-VN" href="${xmlEscape(loc)}"/>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
  return c.body(xml, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

/** Atom feed — full post bodies so crawlers/GEO agents can index without SPA JS. */
crawlRoutes.get("/feed.xml", async (c) => {
  const base = siteUrl(c.env, c.req.url);
  const posts = (await publishedPosts(c.env.DB)).slice(0, 40);
  const updated =
    posts[0]?.published_at || posts[0]?.updated_at || new Date().toISOString();

  const entries = posts
    .map((post) => {
      const link = `${base}/blog/${post.slug}`;
      const summary = xmlEscape(post.excerpt);
      const content = xmlEscape(markdownToPlain(post.body_markdown));
      return `  <entry>
    <title>${xmlEscape(post.title)}</title>
    <link href="${xmlEscape(link)}" rel="alternate" type="text/html"/>
    <id>${xmlEscape(link)}</id>
    <updated>${xmlEscape(post.published_at || post.updated_at)}</updated>
    <summary>${summary}</summary>
    <category term="${xmlEscape(themeLabel(post.theme))}"/>
    <author><name>${xmlEscape(post.author_name)}</name></author>
    <content type="text">${content}</content>
  </entry>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>VivaAge — Góc động viên</title>
  <subtitle>Bài viết động viên mỗi ngày cho người Việt ngoài 40 tuổi. Cadence: ${BLOG_CADENCE_DAYS} ngày/bài.</subtitle>
  <link href="${xmlEscape(base)}/blog" rel="alternate" type="text/html"/>
  <link href="${xmlEscape(base)}/feed.xml" rel="self" type="application/atom+xml"/>
  <id>${xmlEscape(base)}/feed.xml</id>
  <updated>${xmlEscape(updated)}</updated>
  <language>vi-VN</language>
${entries}
</feed>
`;
  return c.body(feed, 200, {
    "Content-Type": "application/atom+xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});
