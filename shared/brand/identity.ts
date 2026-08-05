/** Official brand identity for VivaAge */

export const BRAND = {
  /** Primary product name (one word in UI / logo). */
  name: "VivaAge",
  /** Spaced form used in etymology / prose when needed. */
  nameSpaced: "Viva Age",
  shortName: "VivaAge",
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
  descriptionShort:
    "Chủ động từ tuổi 40 — khỏe mạnh và tự chủ về sau.",
  heroHeadline: "Chủ động từ tuổi 40, sống khỏe và tự chủ về sau",
  locale: "vi_VN",
  language: "vi-VN",
  htmlLang: "vi",
  themeColor: "#1f5c45",
  backgroundColor: "#f7f4ef",
  siteUrl: "https://song-an-40.sycu-lee.workers.dev",
  /** Open Graph / social share image (1200×630). */
  ogImagePath: "/og-image.jpg",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  askLabel: "Hỏi VivaAge",
  editorialIssuer: "VivaAge Biên tập giáo dục",
  blogAuthor: "Biên tập VivaAge",
} as const;

export function pageTitle(section?: string): string {
  if (!section) return `${BRAND.name} | ${BRAND.tagline}`;
  return `${section} | ${BRAND.name}`;
}

export function absoluteUrl(path = "/"): string {
  const base = BRAND.siteUrl.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
