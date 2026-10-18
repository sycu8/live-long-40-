import { foldVietnamese } from "../utils/vietnamese";

export const SAFETY_RULESET_VERSION = "v1.1.0";

export type RiskClass =
  | "chest_pain"
  | "breathing"
  | "unconscious"
  | "stroke"
  | "head_injury"
  | "fall_emergency"
  | "bleeding"
  | "choking"
  | "seizure"
  | "self_harm"
  | "poisoning"
  | "none";

export type SafetyMatch = {
  matched: boolean;
  riskClass: RiskClass;
  message: string;
  rulesetVersion: string;
};

/**
 * NFC, lowercase, diacritics stripped. Patterns below are written once
 * against this form so accented and unaccented questions share a match.
 */
export function normalizeSafetyText(question: string): string {
  return foldVietnamese(question.normalize("NFC")).replace(/\s+/g, " ").trim();
}

const PREVENTION =
  /\b(phong|ngan ngua|lam sao|cach nao|dinh ky|man tinh|lau nam|nhieu nam|thuong xuyen|hay bi|tu nho|la gi|tim hieu|kham dinh ky)\b/;

const HAPPENING_NOW =
  /\b(dang|vua|hom nay|luc nay|bay gio|nua tieng|may phut|dot ngot|dot nhien|tu nua|tu sang|tu chieu|ngay lap tuc)\b/;

function mildFallOnly(text: string): boolean {
  const fell = /\b(bi nga|vua nga|nga)\b/.test(text);
  const mild = /\b(nhe|van tinh|tinh tao)\b/.test(text);
  const red =
    /\b(te|liet|khong cu dong|khong nhac|dap dau|buon non|lo mo|lu lan|chay mau|bat tinh|kho tho|mat y thuc)\b/.test(
      text,
    );
  return fell && mild && !red;
}

/** Education or prevention wording, with no sign the problem is happening now. */
function preventionOnly(text: string): boolean {
  return PREVENTION.test(text) && !HAPPENING_NOW.test(text);
}

function hasActualFall(text: string): boolean {
  if (
    /\bphong nga\b/.test(text) &&
    !/\b(bi nga|vua nga|moi nga|nga xong|nga dap|nga cau|nga xuong|sau khi nga)\b/.test(
      text,
    )
  ) {
    return false;
  }
  return /\b(bi nga|vua nga|moi nga|nga cau|nga o cau|nga xuong|nga dap|sau khi nga|nga xong)\b/.test(
    text,
  );
}

const CALL =
  "Đây có thể là tình huống khẩn cấp. Hãy gọi 115 ngay. VivaAge không chẩn đoán và không thay cuộc gọi cấp cứu.";

function advice(dos: string[], donts: string[]): string {
  return [
    CALL,
    "",
    "Nên làm:",
    ...dos.map((line) => `- ${line}`),
    "",
    "Không nên:",
    ...donts.map((line) => `- ${line}`),
  ].join("\n");
}

const MESSAGES: Record<Exclude<RiskClass, "none">, string> = {
  chest_pain: advice(
    [
      "Gọi 115 và nói rõ địa chỉ, tuổi, đang đau hoặc tức ngực.",
      "Để người bệnh ngồi nghỉ, nới quần áo chật, và ở bên cạnh.",
    ],
    [
      "Không tự cho thuốc, không bảo đi bộ cho đỡ, không để tự lái xe đi viện.",
      "Không chờ xem có hết không.",
    ],
  ),
  breathing: advice(
    ["Gọi 115 ngay.", "Để ngồi thẳng, nới áo, mở thoáng khí."],
    ["Không bịt miệng, không cho ăn hoặc uống.", "Không để người bệnh một mình."],
  ),
  unconscious: advice(
    [
      "Gọi 115 ngay.",
      "Xem còn thở không. Nếu không thở và bạn đã biết ép tim, làm theo hướng dẫn của tổng đài 115.",
    ],
    ["Không đổ nước lên mặt, không cho uống, không lắc mạnh."],
  ),
  stroke: advice(
    [
      "Gọi 115 ngay và nhớ giờ triệu chứng bắt đầu.",
      "Để nằm nghiêng nếu buồn nôn. Không cho ăn uống trong lúc chờ.",
    ],
    ["Không cho thuốc, không đợi đến sáng hay tự đi khám thường."],
  ),
  head_injury: advice(
    [
      "Gọi 115 ngay.",
      "Giữ nằm yên, đỡ đầu và cổ thẳng, ở bên cạnh đến khi có người đến.",
    ],
    ["Không lay gọi mạnh, không cho uống, không tự ý dùng thuốc giảm đau."],
  ),
  fall_emergency: advice(
    [
      "Gọi 115 ngay.",
      "Giữ người bệnh nằm yên tại chỗ và nói chuyện nhẹ để biết còn tỉnh không.",
    ],
    ["Không kéo dậy, không nắn chỗ đau, không cho ăn uống."],
  ),
  bleeding: advice(
    ["Gọi 115 ngay.", "Dùng vải sạch ép thẳng lên chỗ chảy máu và giữ nguyên."],
    ["Không tháo vật đang cắm trong vết thương.", "Không bỏ ép ra để xem đã cầm chưa."],
  ),
  choking: advice(
    [
      "Gọi 115 ngay.",
      "Nếu còn ho được thì khuyến khích ho. Nếu không nói được và không thở, làm theo hướng dẫn của tổng đài 115.",
    ],
    ["Không móc mù vào họng.", "Không cho uống nước để trôi."],
  ),
  seizure: advice(
    [
      "Gọi 115 ngay.",
      "Dọn vật cứng xung quanh, đỡ khỏi va đập, và đặt nghiêng khi cơn đã dừng.",
    ],
    ["Không nhét bất cứ thứ gì vào miệng.", "Không giữ chặt người bệnh."],
  ),
  self_harm: advice(
    [
      "Gọi 115 ngay và nói rõ đang có ý định tự làm hại, để tổng đài hướng dẫn.",
      "Ở lại bên cạnh, cất thuốc và vật sắc. Ở TP. Hồ Chí Minh có thể gọi thêm 1900 1267 (cấp cứu trầm cảm), vẫn giữ cuộc gọi 115 nếu đang nguy cấp.",
    ],
    ["Không bỏ mặc một mình.", "Không tranh cãi hay thử thách."],
  ),
  poisoning: advice(
    [
      "Gọi 115 ngay. Nếu an toàn, giữ vỏ thuốc hoặc chất đã nuốt để đưa cho cấp cứu.",
      "Làm theo đúng hướng dẫn của tổng đài 115.",
    ],
    ["Không tự gây nôn.", "Không tự cho uống thêm sữa, nước hay thuốc."],
  ),
};

function hit(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function matchSymptoms(text: string): Exclude<RiskClass, "none"> | null {
  if (hit(text, /(?:dau|tuc|that|nong|siet)\s+nguc/)) {
    return "chest_pain";
  }

  if (
    hit(text, /kho\s+tho/) &&
    hit(
      text,
      /nang|du\s+doi|khong\s+tho\s+duoc|ngat|mo\s+hoi|dot\s+nhien|nua\s+tieng|\bdang\b/,
    )
  ) {
    return "breathing";
  }
  if (hit(text, /khong\s+tho\s+duoc|ngat\s+tho/)) {
    return "breathing";
  }

  if (
    hit(
      text,
      /meo\s+mieng|noi\s+ngong|kho\s+noi|noi\s+kho|khong\s+noi\s+duoc|noi\s+khong\s+ro|dot\s+quy/,
    ) ||
    hit(
      text,
      /yeu\s+(nua|mot\s+ben|nua\s+nguoi)|liet\s+(nua|mot\s+ben|nua\s+nguoi)|te\s+liet/,
    ) ||
    hit(text, /(tay|chan)\s+khong\s+nhac|khong\s+nhac\s+(tay|chan|len)/) ||
    hit(text, /\bte\b.{0,48}\b(mot\s+ben|nua\s+nguoi|ben\s+trai|ben\s+phai)\b/) ||
    hit(text, /\b(mot\s+ben|nua\s+nguoi|ben\s+trai|ben\s+phai)\b.{0,48}\bte\b/)
  ) {
    return "stroke";
  }

  const headTrauma = hit(text, /dap\s+dau|va\s+dau|dau\s+bi\s+dap|bi\s+dap\s+dau/);
  const headSymptoms = hit(
    text,
    /lu\s+lan|buon\s+non|\bnon\b|lo\s+mo|hon\s+me|khong\s+tinh/,
  );
  if (
    (headTrauma && headSymptoms) ||
    (hasActualFall(text) && headTrauma && headSymptoms)
  ) {
    return "head_injury";
  }
  if (hasActualFall(text) && headSymptoms && hit(text, /\bdau\b/)) {
    return "head_injury";
  }

  if (
    hasActualFall(text) &&
    hit(
      text,
      /khong\s+cu\s+dong|khong\s+nhac|\bte\b|\bliet\b|dap\s+dau|lu\s+lan|lo\s+mo|buon\s+non|mat\s+y\s+thuc/,
    )
  ) {
    return "fall_emergency";
  }

  return null;
}

/** Signs that stay emergencies even inside a “how do I prevent” sentence. */
function matchAlways(text: string): Exclude<RiskClass, "none"> | null {
  if (
    hit(
      text,
      /muon\s+(chet|tu\s+tu\b)|(?<![a-z])tu\s+tu\b|(?<![a-z])tu\s+sat\b|(?<![a-z])tu\s+lam\s+hai|(?<![a-z])khong\s+muon\s+song|(?<![a-z])tu\s+gay\s+thuong/,
    )
  ) {
    return "self_harm";
  }
  if (hit(text, /bat\s+tinh|mat\s+y\s+thuc|khong\s+danh\s+thuc|khong\s+tinh\s+lai/)) {
    return "unconscious";
  }
  if (
    hit(
      text,
      /chay\s+mau\s+(nhieu|khong\s+cam|khong\s+dung|o\s+at)|xuat\s+huyet\s+(nang|nhieu)|mau\s+chay\s+(nhieu|khong\s+cam)/,
    )
  ) {
    return "bleeding";
  }
  return null;
}

function matchAcuteUnlessPrevention(text: string): Exclude<RiskClass, "none"> | null {
  if (
    hit(
      text,
      /bi\s+nghen|dang\s+nghen|bi\s+hac|mac\s+(di\s+vat|xuong|thuc\s+an)|nghen\s+dac|hac\s+xuong/,
    )
  ) {
    return "choking";
  }
  if (hit(text, /co\s+giat|len\s+con\s+(co\s+giat|dong\s+kinh)/)) {
    return "seizure";
  }
  if (hit(text, /ngat\s+xiu/)) return "unconscious";
  if (hit(text, /ngo\s+doc|uong\s+nham|qua\s+lieu|overdose/)) return "poisoning";
  return null;
}

export function evaluateHighRisk(question: string): SafetyMatch {
  const text = normalizeSafetyText(question);
  const blocked = mildFallOnly(text) || preventionOnly(text);
  const riskClass =
    matchAlways(text) ??
    (blocked ? null : (matchAcuteUnlessPrevention(text) ?? matchSymptoms(text)));

  if (!riskClass) {
    return {
      matched: false,
      riskClass: "none",
      message: "",
      rulesetVersion: SAFETY_RULESET_VERSION,
    };
  }

  return {
    matched: true,
    riskClass,
    message: MESSAGES[riskClass],
    rulesetVersion: SAFETY_RULESET_VERSION,
  };
}
