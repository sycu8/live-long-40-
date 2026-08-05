/**
 * Registry of official / authoritative references used in answer bank,
 * library lessons, and seed knowledge. Snippets are educational paraphrases
 * aligned with public guidance — always open the URL for the full text.
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
  /** Short educational paraphrase for citation chips / RAG chunks */
  snippet: string;
};

export const OFFICIAL_SOURCES: OfficialSourceRef[] = [
  {
    id: "byt-portal",
    title: "Cổng thông tin điện tử Bộ Y tế",
    issuer: "Bộ Y tế Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "guideline",
    category: "kham-phong-benh",
    pillar: "health",
    publicationDate: "2024-01-01",
    url: "https://moh.gov.vn/",
    snippet:
      "Bộ Y tế công bố thông tin y tế công cộng và hướng dẫn chuyên môn trên cổng thông tin chính thức. Người dân nên dùng thông tin chính thống khi chuẩn bị khám chữa bệnh và hỏi ý kiến cơ sở y tế khi có triệu chứng.",
  },
  {
    id: "who-hypertension",
    title: "WHO Fact sheet: Hypertension (Tăng huyết áp)",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "kham-phong-benh",
    pillar: "health",
    publicationDate: "2023-03-16",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
    snippet:
      "WHO nêu tăng huyết áp là yếu tố nguy cơ tim mạch quan trọng; đo huyết áp, lối sống lành mạnh và điều trị theo chỉ định chuyên môn giúp kiểm soát. Không tự ý thay đổi thuốc khi chưa được nhân viên y tế hướng dẫn.",
  },
  {
    id: "who-falls",
    title: "WHO Fact sheet: Falls (Ngã)",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "cham-soc-cha-me",
    pillar: "caregiving",
    publicationDate: "2021-04-26",
    url: "https://www.who.int/news-room/fact-sheets/detail/falls",
    snippet:
      "WHO xác định ngã là nguyên nhân chấn thương hàng đầu ở người cao tuổi. Dự phòng gồm môi trường an toàn, ánh sáng đủ, hỗ trợ đi lại; khi ngã có chấn thương hoặc không đứng dậy được cần hỗ trợ y tế kịp thời.",
  },
  {
    id: "who-ageing",
    title: "WHO Fact sheet: Ageing and health",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "suc-khoe-trung-nien",
    pillar: "health",
    publicationDate: "2024-10-01",
    url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    snippet:
      "WHO nhấn mạnh già hóa khỏe mạnh gắn với dự phòng bệnh mạn tính, hoạt động thể lực phù hợp, dinh dưỡng và tiếp cận dịch vụ y tế. Chuẩn bị sớm từ trung niên giúp duy trì chức năng và tự chủ lâu hơn.",
  },
  {
    id: "bhxh-portal",
    title: "Cổng thông tin Bảo hiểm xã hội Việt Nam",
    issuer: "Bảo hiểm xã hội Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "policy",
    category: "nha-o-giay-to",
    pillar: "finance",
    publicationDate: "2024-01-01",
    url: "https://baohiemxahoi.gov.vn/",
    snippet:
      "BHXH Việt Nam công bố thông tin chính thức về bảo hiểm y tế, bảo hiểm xã hội và các thủ tục liên quan. Người tham gia nên kiểm tra quyền lợi, thẻ/bản điện tử và hồ sơ trên kênh chính thống của ngành.",
  },
  {
    id: "sbv-portal",
    title: "Cổng thông tin Ngân hàng Nhà nước Việt Nam",
    issuer: "Ngân hàng Nhà nước Việt Nam",
    trustTier: "official_vn",
    jurisdiction: "VN",
    documentType: "education",
    category: "chuan-bi-tai-chinh",
    pillar: "finance",
    publicationDate: "2024-01-01",
    url: "https://www.sbv.gov.vn/",
    snippet:
      "NHNN công bố chính sách và thông tin liên quan hệ thống ngân hàng. Giáo dục tài chính cá nhân (tiết kiệm, dự phòng) nên dựa trên nguồn chính thống và không đồng nghĩa tư vấn đầu tư cá nhân hóa.",
  },
  {
    id: "who-physical-activity",
    title: "WHO guidelines on physical activity and sedentary behaviour",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "suc-khoe-trung-nien",
    pillar: "health",
    publicationDate: "2020-11-25",
    url: "https://www.who.int/publications/i/item/9789240015128",
    snippet:
      "WHO khuyến nghị người trưởng thành duy trì hoạt động thể lực đều đặn và giảm ngồi lâu; cường độ và hình thức cần phù hợp sức khỏe từng người, đặc biệt khi có bệnh nền — hãy hỏi nhân viên y tế trước khi tăng mức vận động.",
  },
  {
    id: "who-mental-sleep",
    title: "WHO: Mental health of older adults",
    issuer: "Tổ chức Y tế Thế giới (WHO)",
    trustTier: "intl_guideline",
    jurisdiction: "INTL",
    documentType: "guideline",
    category: "tri-nho-tinh-than",
    pillar: "health",
    publicationDate: "2023-10-20",
    url: "https://www.who.int/news-room/fact-sheets/detail/mental-health-of-older-adults",
    snippet:
      "WHO nêu sức khỏe tinh thần người lớn tuổi chịu ảnh hưởng bởi giấc ngủ, bệnh mạn tính và hỗ trợ xã hội. Rối loạn giấc ngủ kéo dài hoặc suy giảm chức năng cần được đánh giá bởi nhân viên y tế, không tự điều trị.",
  },
];

export function officialSourceById(id: string): OfficialSourceRef | undefined {
  return OFFICIAL_SOURCES.find((s) => s.id === id);
}
