export const SAFETY_RULESET_VERSION = "v1.0.0";

export type RiskClass =
  | "chest_pain"
  | "breathing"
  | "unconscious"
  | "stroke"
  | "bleeding"
  | "self_harm"
  | "poisoning"
  | "none";

export type SafetyMatch = {
  matched: boolean;
  riskClass: RiskClass;
  message: string;
  rulesetVersion: string;
};

type Rule = {
  riskClass: Exclude<RiskClass, "none">;
  patterns: RegExp[];
};

/**
 * Deterministic high-risk routing. Patterns cover Vietnamese with and without diacritics.
 * Kept versioned and testable — not optimized for engagement.
 */
const RULES: Rule[] = [
  {
    riskClass: "chest_pain",
    patterns: [
      /đau\s*ngực\s*(dữ\s*dội|nặng|siêu\s*mạnh|không\s*chịu\s*nổi)/i,
      /dau\s*nguc\s*(du\s*doi|nang|sieu\s*manh|khong\s*chiu\s*noi)/i,
      /đau\s*ngực\s*(lan|lan\s*xuống)\s*(cánh\s*tay|hàm)/i,
      /dau\s*nguc\s*(lan|lan\s*xuong)\s*(canh\s*tay|ham)/i,
    ],
  },
  {
    riskClass: "breathing",
    patterns: [
      /khó\s*thở\s*(nặng|dữ\s*dội|không\s*thở\s*được)/i,
      /kho\s*tho\s*(nang|du\s*doi|khong\s*tho\s*duoc)/i,
      /ngạt\s*thở|ngat\s*tho/i,
    ],
  },
  {
    riskClass: "unconscious",
    patterns: [
      /bất\s*tỉnh|bat\s*tinh/i,
      /mất\s*ý\s*thức|mat\s*y\s*thuc/i,
      /không\s*đánh\s*thức\s*được|khong\s*danh\s*thuc\s*duoc/i,
    ],
  },
  {
    riskClass: "stroke",
    patterns: [
      /méo\s*miệng|meo\s*mieng/i,
      /yếu\s*(nửa|một)\s*(người|bên)|yeu\s*(nua|mot)\s*(nguoi|ben)/i,
      /nói\s*khó\s*(hiểu|rõ)|noi\s*kho\s*(hieu|ro)/i,
      /đột\s*quỵ|dot\s*quy/i,
    ],
  },
  {
    riskClass: "bleeding",
    patterns: [
      /chảy\s*máu\s*(nhiều|không\s*cầm)|chay\s*mau\s*(nhieu|khong\s*cam)/i,
      /xuất\s*huyết\s*(nặng|nhiều)|xuat\s*huyet\s*(nang|nhieu)/i,
    ],
  },
  {
    riskClass: "self_harm",
    patterns: [
      /muốn\s*(chết|tự\s*tử)|muon\s*(chet|tu\s*tu)/i,
      /tự\s*làm\s*hại|tu\s*lam\s*hai/i,
      /không\s*muốn\s*sống\s*nữa|khong\s*muon\s*song\s*nua/i,
    ],
  },
  {
    riskClass: "poisoning",
    patterns: [
      /ngộ\s*độc|ngo\s*doc/i,
      /uống\s*(nhầm|quá\s*liều)\s*thuốc|uong\s*(nham|qua\s*lieu)\s*thuoc/i,
      /overdose/i,
    ],
  },
];

const SAFETY_MESSAGE =
  "Tình huống bạn mô tả có thể cần cấp cứu. Hãy gọi cấp cứu địa phương hoặc đến bệnh viện / trạm y tế gần nhất ngay. Sống An 40+ không thể đánh giá tình trạng của bạn và không hướng dẫn điều trị khi khẩn cấp.";

export function evaluateHighRisk(question: string): SafetyMatch {
  const text = question.normalize("NFC").trim();
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          matched: true,
          riskClass: rule.riskClass,
          message: SAFETY_MESSAGE,
          rulesetVersion: SAFETY_RULESET_VERSION,
        };
      }
    }
  }
  return {
    matched: false,
    riskClass: "none",
    message: "",
    rulesetVersion: SAFETY_RULESET_VERSION,
  };
}
