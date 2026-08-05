export const PILLARS = ["health", "finance", "caregiving"] as const;

export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABELS: Record<Pillar, string> = {
  health: "Sức khỏe",
  finance: "Tiền bạc",
  caregiving: "Chăm sóc",
};

export const LIBRARY_CATEGORIES = [
  {
    id: "suc-khoe-trung-nien",
    label: "Sức khỏe tuổi ngoài 40",
    pillar: "health" as const,
  },
  {
    id: "kham-phong-benh",
    label: "Khám bệnh và phòng bệnh",
    pillar: "health" as const,
  },
  {
    id: "chuan-bi-tai-chinh",
    label: "Tiền bạc & chuẩn bị",
    pillar: "finance" as const,
  },
  {
    id: "cham-soc-cha-me",
    label: "Chăm sóc người thân",
    pillar: "caregiving" as const,
  },
  {
    id: "tri-nho-tinh-than",
    label: "Tinh thần & giấc ngủ",
    pillar: "health" as const,
  },
  {
    id: "nha-o-giay-to",
    label: "Nhà cửa, gia đình và giấy tờ",
    pillar: "finance" as const,
  },
] as const;

export const SOURCE_STATUSES = [
  "draft",
  "active",
  "superseded",
  "withdrawn",
] as const;

export const REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export const QUESTION_CLASSIFICATIONS = [
  "health_education",
  "financial_education",
  "caregiving",
  "policy_benefits",
  "product_navigation",
  "high_risk_health",
  "unsupported",
] as const;

export type QuestionClassification =
  (typeof QUESTION_CLASSIFICATIONS)[number];

export const DISCLAIMER =
  "Sống An 40+ giúp bạn tìm hiểu và lập kế hoạch, không phải ứng dụng của Nhà nước, cũng không thay bác sĩ, người tư vấn tiền bạc hay luật sư.";

export const SCORE_DISCLAIMER =
  "Đây là điểm chuẩn bị của bạn, không phải kết luận bệnh hay dự đoán tuổi thọ.";

export const ABSTENTION_MESSAGE =
  "Tôi chưa tìm thấy đủ nguồn tin cậy từ cơ quan nhà nước hoặc Tổ chức Y tế Thế giới để trả lời chắc chắn.";

export const EXAMPLE_QUESTIONS = [
  "Từ tuổi 40 tôi nên kiểm tra sức khỏe gì?",
  "Tôi nên chuẩn bị quỹ dự phòng thế nào?",
  "Làm gì khi cha mẹ bị ngã?",
  "Cần chuẩn bị giấy tờ nào cho tuổi già?",
] as const;

/** Extra suggested questions with prepared answers in the answer bank. */
export const EXTENDED_EXAMPLE_QUESTIONS = [
  ...EXAMPLE_QUESTIONS,
  "Theo dõi huyết áp tại nhà thế nào?",
  "Làm sao để ngủ ngon hơn ở tuổi ngoài 40?",
] as const;
