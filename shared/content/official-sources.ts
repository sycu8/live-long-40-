/**
 * Registry of official references. Titles/snippets use plain Vietnamese
 * for display; URLs point to the authoritative page.
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
      "Bộ Y tế đăng thông tin sức khỏe và hướng dẫn khám chữa bệnh trên cổng chính thức. Nên xem thông tin tại đây và hỏi bác sĩ hoặc trạm y tế gần nhà khi thấy bất thường.",
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
      "Bảo hiểm xã hội Việt Nam công bố thông tin về bảo hiểm y tế, bảo hiểm xã hội và thủ tục liên quan. Nên kiểm tra thẻ/bảo hiểm và hồ sơ trên trang chính thức của ngành.",
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
      "Ngân hàng Nhà nước đăng thông tin chính thức về hệ thống ngân hàng. Việc để dành và lo liệu tiền trong gia đình nên dựa trên nguồn tin cậy — đây không phải lời khuyên mua bán đầu tư cho từng người.",
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
