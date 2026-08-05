import { Hono } from "hono";
import {
  BLOG_CADENCE_DAYS,
  DEFAULT_PUBLIC_SITE_URL,
} from "@shared/constants/blog";
import { INDEXABLE_ROUTES } from "@shared/brand";
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

export function xmlEscape(value: string): string {
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

type LibraryRow = {
  slug: string;
  updated_at: string;
  last_reviewed_at: string | null;
  publication_date: string | null;
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

async function activeLibraryLessons(db: D1Database): Promise<LibraryRow[]> {
  const rows = await db
    .prepare(
      `SELECT slug, updated_at, last_reviewed_at, publication_date
       FROM library_lessons
       WHERE status = 'active'
       ORDER BY category, title`,
    )
    .all<LibraryRow>();
  return rows.results ?? [];
}

/** Sitemap changefreq / priority keyed by path (INDEXABLE_ROUTES order). */
const ROUTE_SEO: Record<string, { changefreq: string; priority: string }> = {
  "/": { changefreq: "weekly", priority: "1.0" },
  "/hom-nay": { changefreq: "weekly", priority: "0.8" },
  "/danh-gia": { changefreq: "monthly", priority: "0.9" },
  "/ke-hoach": { changefreq: "weekly", priority: "0.8" },
  "/hoi": { changefreq: "weekly", priority: "0.9" },
  "/blog": { changefreq: "daily", priority: "0.9" },
  "/thu-vien": { changefreq: "weekly", priority: "0.85" },
  "/ho-so": { changefreq: "monthly", priority: "0.5" },
};

export type SitemapUrl = {
  path: string;
  lastmod: string;
  changefreq: string;
  priority: string;
};

export function buildSitemapUrls(input: {
  today: string;
  blogPosts: Array<{ slug: string; published_at?: string; updated_at?: string }>;
  libraryLessons: Array<{
    slug: string;
    updated_at?: string;
    last_reviewed_at?: string | null;
    publication_date?: string | null;
  }>;
}): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  for (const route of INDEXABLE_ROUTES) {
    const seo = ROUTE_SEO[route.path] ?? {
      changefreq: "weekly",
      priority: "0.6",
    };
    urls.push({
      path: route.path,
      lastmod: input.today,
      changefreq: seo.changefreq,
      priority: seo.priority,
    });
  }

  for (const lesson of input.libraryLessons) {
    const lastmod = (
      lesson.updated_at ||
      lesson.last_reviewed_at ||
      lesson.publication_date ||
      input.today
    ).slice(0, 10);
    urls.push({
      path: `/thu-vien/${lesson.slug}`,
      lastmod,
      changefreq: "monthly",
      priority: "0.75",
    });
  }

  for (const post of input.blogPosts) {
    const lastmod = (post.published_at || post.updated_at || input.today).slice(
      0,
      10,
    );
    urls.push({
      path: `/blog/${post.slug}`,
      lastmod,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  return urls;
}

export function renderSitemapXml(base: string, urls: SitemapUrl[]): string {
  const origin = base.replace(/\/$/, "");
  const blocks = urls.map((u) => {
    const loc = `${origin}${u.path === "/" ? "/" : u.path}`;
    return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <xhtml:link rel="alternate" hreflang="vi-VN" href="${xmlEscape(loc)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}"/>
    <lastmod>${xmlEscape(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join("\n")}
</urlset>
`;
}

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
  const today = new Date().toISOString().slice(0, 10);
  const [posts, lessons] = await Promise.all([
    publishedPosts(c.env.DB),
    activeLibraryLessons(c.env.DB),
  ]);

  const urls = buildSitemapUrls({
    today,
    blogPosts: posts,
    libraryLessons: lessons,
  });
  const xml = renderSitemapXml(base, urls);

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
