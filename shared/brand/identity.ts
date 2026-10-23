/** Official brand & SEO/GEO identity for VivaAge */

export const BRAND = {
  /** Primary product name (one word in UI / logo). */
  name: "VivaAge",
  /** Spaced form used in etymology / prose when needed. */
  nameSpaced: "Viva Age",
  shortName: "VivaAge",
  legalName: "VivaAge",
  tagline: "Chuẩn bị hôm nay, tự chủ về sau",
  /** Full lockup line for meta / marketing. */
  taglineLockup: "VivaAge - Chuẩn bị hôm nay, tự chủ về sau",
  /** Why the name — shown on homepage. */
  nameRationale: {
    viva: "“Viva” gợi sức sống, tích cực, không nhấn mạnh sự già yếu.",
    age: "“Age” thể hiện đúng lĩnh vực tuổi tác và healthy aging.",
  },
  description:
    "VivaAge giúp bạn hiểu rõ những gì cần chuẩn bị cho tương lai, từ sức khỏe, tài chính đến kỹ năng chăm sóc bản thân và gia đình.",
  descriptionShort: "Chủ động từ tuổi 40 — khỏe mạnh và tự chủ về sau.",
  heroHeadline: "Chủ động từ tuổi 40, sống khỏe và tự chủ về sau",
  locale: "vi_VN",
  language: "vi-VN",
  htmlLang: "vi",
  country: "VN",
  countryName: "Việt Nam",
  themeColor: "#1f5c45",
  backgroundColor: "#f7f4ef",
  siteUrl: "https://vivaage.orangecloud.vn",
  /** Open Graph / social share image (1200×630). */
  ogImagePath: "/og-image.jpg",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  sameAs: [] as string[],
  contactEmail: "",
  category: "EducationApplication",
  keywords: [
    "VivaAge",
    "chuẩn bị tuổi già",
    "healthy aging",
    "người Việt 40+",
    "kế hoạch 30 ngày",
    "sức khỏe trung niên",
    "quỹ dự phòng",
    "chăm sóc người thân",
    "đánh giá sẵn sàng",
  ],
  colors: {
    cream: "#f7f4ef",
    creamDark: "#ebe5db",
    ink: "#1c2a24",
    inkMuted: "#4a5c54",
    green: "#1f5c45",
    greenDark: "#163f30",
    greenSoft: "#d8ebe2",
    blue: "#3d5a73",
    sand: "#c4b8a5",
  },
  askLabel: "Hỏi VivaAge",
  editorialIssuer: "VivaAge Biên tập giáo dục",
  blogAuthor: "Biên tập VivaAge",
} as const;

export type PageSeo = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  imagePath?: string;
  noIndex?: boolean;
};

export function pageTitle(section?: string): string {
  if (!section) return `${BRAND.name} | ${BRAND.tagline}`;
  return `${section} | ${BRAND.name}`;
}

export function absoluteUrl(path = "/"): string {
  const base = BRAND.siteUrl.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Static routes for SEO inventory / DocumentHead */
export const INDEXABLE_ROUTES: PageSeo[] = [
  {
    path: "/",
    title: pageTitle(),
    description: BRAND.description,
    type: "website",
  },
  {
    path: "/hom-nay",
    title: pageTitle("Hôm nay"),
    description:
      "Xem điểm sẵn sàng, tiến độ tuần và việc nhỏ cần làm hôm nay trên VivaAge.",
  },
  {
    path: "/danh-gia",
    title: pageTitle("Đánh giá sẵn sàng"),
    description:
      "Bài đánh giá khoảng 7 phút giúp bạn hiểu mức độ sẵn sàng về sức khỏe, tài chính và chăm sóc.",
  },
  {
    path: "/ke-hoach",
    title: pageTitle("Kế hoạch 30 ngày"),
    description:
      "Kế hoạch 30 ngày với việc nhỏ mỗi tuần để chuẩn bị cho tương lai một cách vừa sức.",
  },
  {
    path: "/hoi",
    title: pageTitle(BRAND.askLabel),
    description:
      "Đặt câu hỏi giáo dục về sức khỏe trung niên, quỹ dự phòng, chăm sóc và giấy tờ — có nguồn.",
  },
  {
    path: "/blog",
    title: pageTitle("Góc động viên"),
    description:
      "Bài viết động viên giúp người 40+ bớt tiêu cực và thích nghi với hành trình tuổi già.",
  },
  {
    path: "/thu-vien",
    title: pageTitle("Thư viện"),
    description:
      "Bài học ngắn về sức khỏe, tài chính và kỹ năng chăm sóc cho tuổi trung niên.",
  },
  {
    path: "/ho-so",
    title: pageTitle("Hồ sơ & quyền riêng tư"),
    description:
      "Hiểu cách VivaAge bảo vệ phiên ẩn danh và giới hạn của công cụ giáo dục.",
  },
];

export const NOINDEX_ROUTES = ["/admin"] as const;

/** Same person entity as the Orange Cloud hub JSON-LD. */
export const PERSON_ID = "https://orangecloud.vn/#person";

export const HUB_SITE = {
  href: "https://orangecloud.vn/",
  nameVi: "Orange Cloud",
  nameEn: "Orange Cloud",
} as const;

/** Other public projects by the same person. */
export const SIBLING_SITES = [
  {
    href: "https://onboarding.orangecloud.vn/",
    nameVi: "Học Cloudflare",
    nameEn: "Cloudflare Starter Hub",
  },
  {
    href: "https://ready.orangecloud.vn/",
    nameVi: "CF Ready",
    nameEn: "Go-live readiness",
  },
  {
    href: "https://blog.orangecloud.vn/",
    nameVi: "OrangeCloud Insights",
    nameEn: "Notes on security, cloud, and AI",
  },
] as const;

export function canonicalHostname(siteUrl?: string): string {
  const raw = siteUrl?.trim() || BRAND.siteUrl;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return new URL(BRAND.siteUrl).hostname.toLowerCase();
  }
}

/** Non-canonical hosts (workers.dev, previews, localhost) should not be indexed. */
export function robotsTagForHost(
  requestHost: string,
  canonicalHost = canonicalHostname(),
): string | null {
  const host = requestHost.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host === canonicalHost) return null;
  return "noindex, nofollow";
}

/** Production workers.dev name and Wrangler preview hosts share this suffix. */
export function isWorkersDevHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return host === "workers.dev" || host.endsWith(".workers.dev");
}

function canonicalOrigin(siteUrl?: string): string {
  const raw = siteUrl?.trim() || BRAND.siteUrl;
  try {
    return new URL(raw).origin;
  } catch {
    return new URL(BRAND.siteUrl).origin;
  }
}

/**
 * GET/HEAD HTML on workers.dev or a preview host moves to the same path on
 * the canonical origin. API, JSON, and other machine responses stay put.
 */
export function htmlCanonicalRedirect(input: {
  method: string;
  requestUrl: string;
  accept?: string | null;
  canonicalOrigin?: string;
}): string | null {
  let url: URL;
  try {
    url = new URL(input.requestUrl);
  } catch {
    return null;
  }

  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if (!isWorkersDevHost(url.hostname)) return null;

  const path = url.pathname;
  if (path === "/api" || path.startsWith("/api/")) return null;
  if (path === "/mcp" || path.startsWith("/mcp/")) return null;
  if (path.startsWith("/.well-known/")) return null;
  const leaf = path.slice(path.lastIndexOf("/") + 1);
  if (leaf.includes(".") && !/\.html?$/i.test(leaf)) return null;

  const accept = (input.accept ?? "").toLowerCase();
  if (accept.includes("application/json") && !accept.includes("text/html")) return null;

  const origin = canonicalOrigin(input.canonicalOrigin);
  if (url.hostname.toLowerCase() === new URL(origin).hostname.toLowerCase()) return null;
  return `${origin}${path}${url.search}`;
}
