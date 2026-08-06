/**
 * Registry of official references. Each entry MUST point to a specific
 * document or tool page (title + deep URL) — never an organization homepage alone.
 */
export type OfficialSourceRef = {
  id: string;
  title: string;
  issuer: string;
  trustTier: "official_vn" | "intl_guideline";
  jurisdiction: string;
  documentType: "guideline" | "policy" | "education";
  category: string;
  pillar: "health" | "finance" | "caregiving";
  publicationDate: string;
  url: string;
  /** Short plain-Vietnamese paraphrase for citation chips / RAG chunks */
  snippet: string;
};

/** Organization homepages that must not be used as the sole citation URL. */
export const FORBIDDEN_HOMEPAGE_URLS = [
  "https://moh.gov.vn/",
  "https://moh.gov.vn",
  "https://baohiemxahoi.gov.vn/",
  "https://baohiemxahoi.gov.vn",
  "https://www.sbv.gov.vn/",
  "https://www.sbv.gov.vn",
  "https://sbv.gov.vn/",
  "https://sbv.gov.vn",
  "https://www.who.int/",
  "https://www.who.int",
] as const;

export function isGenericHomepageUrl(url: string): boolean {
  const normalized = url.trim().replace(/\/+$/, "");
  return FORBIDDEN_HOMEPAGE_URLS.some(
    (home) => home.replace(/\/+$/, "") === normalized,
  );
}

export const OFFICIAL_SOURCES: OfficialSourceRef[] = [
  {
    id: "byt-elderly-checkup",
    title:
      "Khám sức khỏe định kỳ và chăm sóc người cao tuổi — Bộ Y tế",
    issuer: "Bộ Y tế Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "guideline",
    category: "kham-phong-benh",
    pillar: "health",
    publicationDate: "2023-12-01",
    url: "https://moh.gov.vn/hoat-dong-cua-dia-phuong/-/asset_publisher/gHbla8vOQDuS/content/trung-binh-nguoi-cao-tuoi-o-viet-nam-mac-nhieu-benh-ket-hop-chi-phi-ieu-tri-cao-gap-8-10-lan-nguoi-tre",
    snippet:
      "Bộ Y tế nhấn mạnh người cao tuổi nên khám sức khỏe định kỳ, có sổ theo dõi bệnh và dùng thuốc đúng chỉ định bác sĩ — hỏi cơ sở y tế gần nhà khi thấy bất thường.",
  },
  {
    id: "byt-drug-registration-lookup",
    title:
      "Hướng dẫn tra cứu giấy đăng ký lưu hành thuốc — Cục Quản lý Dược, Bộ Y tế",
    issuer: "Bộ Y tế Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "guideline",
    category: "kham-phong-benh",
    pillar: "health",
    publicationDate: "2024-06-01",
    url: "https://moh.gov.vn/tin-lien-quan/-/asset_publisher/vjYyM7O9aWnX/content/cuc-quan-ly-duoc-bo-y-te-huong-dan-nguoi-dan-doanh-nghiep-tra-cuu-thong-tin-giay-ang-ky-luu-hanh-thuoc",
    snippet:
      "Cục Quản lý Dược (Bộ Y tế) hướng dẫn người dân tra cứu thông tin thuốc đã được cấp phép; khi mua thuốc kê đơn cần theo đơn bác sĩ và kiểm tra nhãn, hạn dùng, nguồn gốc.",
  },
  {
    id: "who-hypertension",
    title: "Tăng huyết áp — Tổ chức Y tế Thế giới",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "kham-phong-benh",
    pillar: "health",
    publicationDate: "2023-03-16",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
    snippet:
      "Tổ chức Y tế Thế giới cho biết huyết áp cao làm tăng nguy cơ bệnh tim mạch. Nên đo huyết áp đều, sống lành mạnh và chỉ đổi thuốc khi có lời bác sĩ — không tự ý tăng, giảm hay ngưng thuốc.",
  },
  {
    id: "who-falls",
    title: "Ngã ở người cao tuổi — Tổ chức Y tế Thế giới",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "cham-soc-cha-me",
    pillar: "caregiving",
    publicationDate: "2021-04-26",
    url: "https://www.who.int/news-room/fact-sheets/detail/falls",
    snippet:
      "Tổ chức Y tế Thế giới cho biết ngã là nguyên nhân chấn thương phổ biến ở người lớn tuổi. Nên giữ nhà cửa thông thoáng, đủ sáng; nếu ngã mà không đứng dậy được hoặc đau nhiều thì cần đưa đi cấp cứu kịp thời.",
  },
  {
    id: "who-ageing",
    title: "Già hóa và sức khỏe — Tổ chức Y tế Thế giới",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "suc-khoe-trung-nien",
    pillar: "health",
    publicationDate: "2024-10-01",
    url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    snippet:
      "Tổ chức Y tế Thế giới khuyến khích chuẩn bị sớm từ tuổi ngoài 40: khám bệnh đều, vận động vừa sức, ăn uống hợp lý và đi khám khi cần — để giữ sức và sống tự chủ lâu hơn.",
  },
  {
    id: "bhxh-bhyt-card-lookup",
    title: "Tra cứu giá trị sử dụng thẻ BHYT — Bảo hiểm xã hội Việt Nam",
    issuer: "Bảo hiểm xã hội Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "policy",
    category: "nha-o-giay-to",
    pillar: "finance",
    publicationDate: "2024-01-01",
    url: "https://baohiemxahoi.gov.vn/tracuu/Pages/tra-cuu-thoi-han-su-dung-the-bhyt.aspx",
    snippet:
      "Trên trang tra cứu của Bảo hiểm xã hội Việt Nam, người tham gia có thể kiểm tra thời hạn và giá trị sử dụng thẻ bảo hiểm y tế để tránh gián đoạn quyền lợi khám chữa bệnh.",
  },
  {
    id: "bhxh-pension-procedure",
    title:
      "Thủ tục giải quyết hưởng lương hưu, trợ cấp hàng tháng — Bảo hiểm xã hội Việt Nam",
    issuer: "Bảo hiểm xã hội Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "policy",
    category: "nha-o-giay-to",
    pillar: "finance",
    publicationDate: "2024-01-01",
    url: "https://baohiemxahoi.gov.vn/thu-tuc-hanh-chinh/pages/default.aspx?ItemID=54",
    snippet:
      "Bảo hiểm xã hội Việt Nam công bố thành phần hồ sơ và cách nộp để giải quyết hưởng lương hưu, trợ cấp hàng tháng — nên xem đúng thủ tục trước khi gom giấy tờ.",
  },
  {
    id: "sbv-financial-education",
    title:
      "Truyền thông giáo dục tài chính và Chiến lược tài chính toàn diện — Ngân hàng Nhà nước Việt Nam",
    issuer: "Ngân hàng Nhà nước Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "education",
    category: "chuan-bi-tai-chinh",
    pillar: "finance",
    publicationDate: "2024-06-01",
    url: "https://sbv.gov.vn/vi/w/sbv599430",
    snippet:
      "Ngân hàng Nhà nước nhấn mạnh giáo dục tài chính giúp người dân nâng cao kiến thức quản lý chi tiêu, tiết kiệm và giảm rủi ro — đây là thông tin giáo dục, không phải lời khuyên đầu tư cá nhân.",
  },
  {
    id: "who-physical-activity",
    title: "Vận động thể chất — Tổ chức Y tế Thế giới",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "suc-khoe-trung-nien",
    pillar: "health",
    publicationDate: "2020-11-25",
    url: "https://www.who.int/publications/i/item/9789240015128",
    snippet:
      "Tổ chức Y tế Thế giới khuyến khích người lớn vận động đều và bớt ngồi lâu. Mức độ vận động nên vừa với sức mình; nếu đang có bệnh, hãy hỏi bác sĩ trước khi tập nặng hơn.",
  },
  {
    id: "who-mental-sleep",
    title: "Sức khỏe tinh thần người lớn tuổi — Tổ chức Y tế Thế giới",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "tri-nho-tinh-than",
    pillar: "health",
    publicationDate: "2023-10-20",
    url: "https://www.who.int/news-room/fact-sheets/detail/mental-health-of-older-adults",
    snippet:
      "Tổ chức Y tế Thế giới cho biết giấc ngủ, bệnh lâu ngày và sự quan tâm của người thân đều ảnh hưởng tinh thần người lớn tuổi. Mất ngủ kéo dài hoặc mệt mỏi nhiều nên đi khám, không tự chữa.",
  },
];

export function officialSourceById(id: string): OfficialSourceRef | undefined {
  return OFFICIAL_SOURCES.find((s) => s.id === id);
}
