/** Official brand & SEO/GEO identity for Sống An 40+ */

export const BRAND = {
  name: "Sống An 40+",
  shortName: "Sống An",
  legalName: "Sống An 40+",
  tagline: "Chuẩn bị tuổi già từ tuổi 40 — khỏe, tự chủ, bình tĩnh.",
  description:
    "Sống An 40+ giúp người Việt từ tuổi 40 chuẩn bị sức khỏe, tài chính và kỹ năng chăm sóc cho tuổi già qua đánh giá sẵn sàng, kế hoạch 30 ngày, thư viện và hỏi đáp có nguồn.",
  descriptionShort:
    "Chuẩn bị sức khỏe, tài chính và chăm sóc từ tuổi 40 — công cụ giáo dục cho người Việt.",
  locale: "vi_VN",
  language: "vi-VN",
  htmlLang: "vi",
  country: "VN",
  countryName: "Việt Nam",
  themeColor: "#1f5c45",
  backgroundColor: "#f7f4ef",
  /** Primary public origin (Workers). Override when custom domain is attached. */
  siteUrl: "https://song-an-40.sycu-lee.workers.dev",
  sameAs: [] as string[],
  contactEmail: "",
  category: "EducationApplication",
  keywords: [
    "Sống An 40+",
    "chuẩn bị tuổi già",
    "người Việt 40+",
    "kế hoạch 30 ngày",
    "sức khỏe trung niên",
    "quỹ dự phòng",
    "chăm sóc người thân",
    "giáo dục tài chính",
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
} as const;

export type PageSeo = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  imagePath?: string;
  noIndex?: boolean;
};

export function absoluteUrl(path = "/"): string {
  const base = BRAND.siteUrl.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageTitle(section?: string): string {
  if (!section) return `${BRAND.name} | ${BRAND.tagline}`;
  return `${section} | ${BRAND.name}`;
}

/** Static routes for sitemap + SEO inventory */
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
      "Xem điểm sẵn sàng, tiến độ tuần và việc nhỏ cần làm hôm nay trên Sống An 40+.",
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
      "Kế hoạch 30 ngày với việc nhỏ mỗi tuần để chuẩn bị tuổi già một cách vừa sức.",
  },
  {
    path: "/hoi",
    title: pageTitle("Hỏi Sống An"),
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
      "Hiểu cách Sống An 40+ bảo vệ phiên ẩn danh và giới hạn của công cụ giáo dục.",
  },
];

export const NOINDEX_ROUTES = ["/admin"] as const;
