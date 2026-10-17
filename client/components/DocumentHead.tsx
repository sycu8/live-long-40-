import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  BRAND,
  INDEXABLE_ROUTES,
  NOINDEX_ROUTES,
  absoluteUrl,
  pageTitle,
  homeJsonLdGraph,
  webPageJsonLd,
  type PageSeo,
} from "@shared/brand";

const DEFAULT_OG = "/og-image.jpg";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${CSS.escape(key)}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  const extraKey = extra
    ? Object.entries(extra)
        .map(([k, v]) => `[${k}="${CSS.escape(v)}"]`)
        .join("")
    : "";
  const selector = `link[rel="${CSS.escape(rel)}"]${extraKey}`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (extra) {
      for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function resolvePage(pathname: string): PageSeo {
  const exact = INDEXABLE_ROUTES.find((r) => r.path === pathname);
  if (exact) return exact;

  if (pathname.startsWith("/blog/")) {
    return {
      path: pathname,
      title: pageTitle("Góc động viên"),
      description:
        "Bài viết động viên giúp người 40+ bớt tiêu cực và thích nghi với hành trình tuổi già.",
      type: "article",
    };
  }
  if (pathname.startsWith("/thu-vien/")) {
    return {
      path: pathname,
      title: pageTitle("Thư viện"),
      description:
        "Bài học ngắn về sức khỏe, tài chính và kỹ năng chăm sóc cho tuổi trung niên.",
    };
  }
  if (pathname.startsWith("/ket-qua")) {
    return {
      path: pathname,
      title: pageTitle("Kết quả đánh giá"),
      description: "Xem điểm sẵn sàng theo sức khỏe, tài chính và chăm sóc trên VivaAge.",
      noIndex: true,
    };
  }

  return {
    path: pathname,
    title: pageTitle(),
    description: BRAND.description,
    noIndex: true,
  };
}

function isNoIndex(pathname: string, page: PageSeo): boolean {
  if (page.noIndex) return true;
  return NOINDEX_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Client-side document meta for SPA routes (title, OG, canonical, JSON-LD).
 * Static defaults in index.html cover the first paint / crawlers of `/`.
 */
export function DocumentHead({
  override,
}: {
  override?: Partial<PageSeo> & { jsonLd?: unknown };
} = {}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = resolvePage(pathname);
    const page: PageSeo = {
      ...base,
      ...override,
      path: override?.path ?? base.path,
      title: override?.title ?? base.title,
      description: override?.description ?? base.description,
    };

    const url = absoluteUrl(page.path);
    const image = absoluteUrl(page.imagePath ?? DEFAULT_OG);
    const robots = isNoIndex(pathname, page)
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1";

    document.title = page.title;
    document.documentElement.lang = BRAND.htmlLang;

    upsertMeta("name", "description", page.description);
    upsertMeta("name", "keywords", BRAND.keywords.join(", "));
    upsertMeta("name", "robots", robots);
    upsertMeta("name", "googlebot", robots);
    upsertMeta("name", "author", BRAND.name);
    upsertMeta("name", "application-name", BRAND.name);
    upsertMeta("name", "apple-mobile-web-app-title", BRAND.shortName);
    upsertMeta("name", "theme-color", BRAND.themeColor);
    upsertMeta("name", "color-scheme", "light");

    // GEO / locale
    upsertMeta("name", "geo.region", BRAND.country);
    upsertMeta("name", "geo.placename", BRAND.countryName);
    upsertMeta("name", "language", BRAND.language);
    upsertMeta("name", "content-language", BRAND.language);

    // Open Graph
    upsertMeta("property", "og:type", page.type === "article" ? "article" : "website");
    upsertMeta("property", "og:site_name", BRAND.name);
    upsertMeta("property", "og:locale", BRAND.locale);
    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", `${BRAND.name} — ${BRAND.tagline}`);

    // Twitter
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", page.title);
    upsertMeta("name", "twitter:description", page.description);
    upsertMeta("name", "twitter:image", image);
    upsertMeta("name", "twitter:image:alt", `${BRAND.name} — ${BRAND.tagline}`);

    upsertLink("canonical", url);
    upsertLink("alternate", url, { hreflang: BRAND.language });
    upsertLink("alternate", url, { hreflang: "x-default" });
    upsertLink("ai-catalog", absoluteUrl("/.well-known/ai-catalog.json"), {
      type: "application/json",
    });
    upsertLink("ard", absoluteUrl("/.well-known/ard.json"), {
      type: "application/json",
    });

    if (pathname === "/") {
      upsertJsonLd("sa-jsonld", override?.jsonLd ?? homeJsonLdGraph());
    } else {
      upsertJsonLd("sa-jsonld", override?.jsonLd ?? webPageJsonLd(page));
    }
  }, [pathname, override]);

  return null;
}
