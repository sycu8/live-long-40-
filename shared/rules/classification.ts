import type { QuestionClassification } from "../constants/product";
import { evaluateHighRisk } from "./safety";

const KEYWORDS: Array<{ classification: QuestionClassification; patterns: RegExp[] }> = [
  {
    classification: "product_navigation",
    patterns: [
      /làm\s*sao\s*để\s*(làm|bắt\s*đầu)\s*(bài\s*đánh\s*giá|kiểm\s*tra)/i,
      /ke\s*hoach\s*30\s*ngay|kế\s*hoạch\s*30\s*ngày/i,
      /thu\s*vien|thư\s*viện/i,
      /song\s*an\s*40|sống\s*an\s*40/i,
    ],
  },
  {
    classification: "financial_education",
    patterns: [
      /quỹ\s*dự\s*phòng|quy\s*du\s*phong/i,
      /về\s*hưu|ve\s*huu|hưu\s*trí|huu\s*tri/i,
      /chi\s*phí|chi\s*phi|tiết\s*kiệm|tiet\s*kiem/i,
      /bảo\s*hiểm|bao\s*hiem|giấy\s*tờ|giay\s*to/i,
    ],
  },
  {
    classification: "caregiving",
    patterns: [
      /cha\s*mẹ|cha\s*me|người\s*thân|nguoi\s*than/i,
      /ngã|nga\b|chăm\s*sóc|cham\s*soc/i,
      /liên\s*hệ\s*khẩn|lien\s*he\s*khan/i,
    ],
  },
  {
    classification: "policy_benefits",
    patterns: [
      /chính\s*sách|chinh\s*sach/i,
      /trợ\s*cấp|tro\s*cap|bhxh|bhyt/i,
      /luật|luat|nghị\s*định|nghi\s*dinh/i,
    ],
  },
  {
    classification: "health_education",
    patterns: [
      /sức\s*khỏe|suc\s*khoe|huyết\s*áp|huyet\s*ap/i,
      /khám|kham|phòng\s*bệnh|phong\s*benh/i,
      /vận\s*động|van\s*dong|giấc\s*ngủ|giac\s*ngu/i,
    ],
  },
];

export function classifyQuestion(question: string): QuestionClassification {
  const risk = evaluateHighRisk(question);
  if (risk.matched) return "high_risk_health";

  const text = question.normalize("NFC");

  if (
    /đầu\s*tư|dau\s*tu|mua\s*cổ\s*phiếu|mua\s*co\s*phieu|kê\s*đơn|ke\s*don|chẩn\s*đoán\s*cho\s*tôi|chan\s*doan\s*cho\s*toi/.test(
      text,
    )
  ) {
    return "unsupported";
  }

  for (const entry of KEYWORDS) {
    if (entry.patterns.some((p) => p.test(text))) {
      return entry.classification;
    }
  }

  return "health_education";
}

/** Preserve original query; also produce ASCII-folded form for non-diacritic matching. */
export function normalizeQuery(original: string): {
  original: string;
  normalized: string;
  withoutDiacritics: string;
} {
  const trimmed = original.normalize("NFC").trim().replace(/\s+/g, " ");
  const withoutDiacritics = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
  return {
    original: trimmed,
    normalized: trimmed.toLowerCase(),
    withoutDiacritics,
  };
}
