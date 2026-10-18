import { foldVietnamese } from "../utils/vietnamese";

export const SAFETY_RULESET_VERSION = "v1.2.0";

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
  | "low_blood_sugar"
  | "severe_allergy"
  | "none";

export type SafetyMatch = {
  matched: boolean;
  riskClass: RiskClass;
  message: string;
  rulesetVersion: string;
};

/**
 * NFC, lowercase, diacritics stripped. Symptom patterns are written once
 * against this form. Self-harm, "hóc", and "té" stay on the accented text
 * when the question has tones, because folding collides with "từ từ", "học", and "tê".
 */
export function normalizeSafetyText(question: string): string {
  return foldVietnamese(question.normalize("NFC")).replace(/\s+/g, " ").trim();
}

const TONE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Explicit prevention or past markers. "làm sao / là gì / hay bị" are not in this list. */
const PAST_OR_PREVENTION =
  /\b(ngan ngua|dau hieu|nam ngoai|tung bi|lau nam|man tinh|on dinh|dinh ky|gang suc|tim hieu|tu nho|nhieu nam)\b/;

/** A real crisis word. Prevention wording must not hide these. */
const ACUTE =
  /\b(du doi|va mo hoi|lan ra|khong tho duoc|dot nhien|khong dung day|khong tu dung|khong day duoc|tho khong noi|moi tim)\b/;

function accentedText(question: string): string {
  return question.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasTone(question: string): boolean {
  return TONE.test(question.normalize("NFC"));
}

function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(
    text,
  );
}

/** "phòng ngã / đề phòng / cách phòng đột quỵ", not "phòng khách" or "phòng khám". */
function hasPreventionPhong(text: string): boolean {
  return /\b((?:de|cach)\s+phong|phong\s+(?:nga|benh|ngua|chong|tranh|dot|di|te|ung))\b/.test(
    text,
  );
}

function definitionOnly(text: string): boolean {
  if (!/\bla gi\b/.test(text)) return false;
  return !/\b(dang|vua|bi|hom nay|luc nay|bay gio|nua tieng|tu nay|tu sang|ngay lap tuc)\b/.test(
    text,
  );
}

function preventionOnly(text: string): boolean {
  if (ACUTE.test(text)) return false;
  if (PAST_OR_PREVENTION.test(text)) return true;
  if (hasPreventionPhong(text)) return true;
  if (definitionOnly(text)) return true;
  return false;
}

function mildFallOnly(text: string): boolean {
  if (ACUTE.test(text)) return false;
  const fell = /\b(bi nga|vua nga|nga)\b/.test(text);
  const mild = /\b(nhe|van tinh|tinh tao)\b/.test(text);
  const red =
    /\b(te|liet|khong cu dong|khong nhac|khong dung|dap dau|buon non|lo mo|lu lan|chay mau|bat tinh|kho tho|mat y thuc|dau hong)\b/.test(
      text,
    );
  return fell && mild && !red;
}

/** "té" only. Folded "te" is also "tê", so unaccented text cannot use this word. */
function mentionsTe(question: string, accented: string): boolean {
  return hasTone(question) && hasPhrase(accented, "té");
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
  low_blood_sugar: advice(
    [
      "Gọi 115 ngay.",
      "Nếu người bệnh còn tỉnh và nuốt được, cho uống nước ngọt. Làm theo hướng dẫn của tổng đài 115.",
    ],
    [
      "Không đổ nước hoặc nhét thức ăn vào miệng nếu lơ mơ hoặc không nuốt được.",
      "Không bỏ mặc một mình.",
    ],
  ),
  severe_allergy: advice(
    [
      "Gọi 115 ngay.",
      "Ngừng tiếp xúc với thứ vừa gây phản ứng. Nếu đã có bút epinephrine và biết cách dùng, dùng theo hướng dẫn sẵn có rồi nói với tổng đài 115.",
    ],
    ["Không cho thêm thức ăn, thuốc khác, hoặc nước nếu đang khó thở."],
  ),
};

function cantStand(text: string): boolean {
  return (
    /\bkhong\s+(?:tu\s+|the\s+)?dung\s+(?:day|len)(?:\s+duoc)?\b/.test(text) ||
    /\bkhong\s+(?:ngoi\s+)?day\s+duoc\b/.test(text)
  );
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

function matchSelfHarm(question: string, accented: string, folded: string): boolean {
  const follow = hasTone(question)
    ? /(?:^|[^\p{L}\p{N}_])đi theo[\s\S]{0,40}?cho xong/u
    : /\bdi theo[\s\S]{0,40}?cho xong/;
  if (follow.test(hasTone(question) ? accented : folded)) return true;

  if (hasTone(question)) {
    const phrases = [
      "tự tử",
      "tự sát",
      "tự làm hại",
      "tự gây thương",
      "chán sống",
      "kết thúc tất cả",
    ];
    if (phrases.some((phrase) => hasPhrase(accented, phrase))) return true;
    if (hasPhrase(accented, "chán đời")) return true;
    if (/(?:^|[^\p{L}\p{N}_])không(?:\s+còn)?\s+thiết sống/u.test(accented)) return true;
    if (hasPhrase(accented, "muốn chết") && !hasPhrase(accented, "không muốn chết")) {
      return true;
    }
    if (
      hasPhrase(accented, "không muốn sống") &&
      !/\bkhông muốn sống\s+chung\b/u.test(accented)
    ) {
      return true;
    }
    return false;
  }

  const foldedPhrases = [
    "tu tu",
    "tu sat",
    "tu lam hai",
    "tu gay thuong",
    "chan song",
    "ket thuc tat ca",
  ];
  if (foldedPhrases.some((phrase) => hasPhrase(folded, phrase))) return true;
  if (/\bkhong(?:\s+con)?\s+thiet song\b/.test(folded)) return true;
  if (hasPhrase(folded, "muon chet") && !hasPhrase(folded, "khong muon chet"))
    return true;
  if (
    hasPhrase(folded, "khong muon song") &&
    !/\bkhong muon song\s+chung\b/.test(folded)
  ) {
    return true;
  }
  return false;
}

function matchChoking(question: string, accented: string, folded: string): boolean {
  if (hasTone(question) && (hasPhrase(accented, "hóc") || hasPhrase(accented, "sặc"))) {
    return true;
  }
  if (
    !hasTone(question) &&
    /\b(bi hoc|dang hoc|hoc xuong|hoc di vat|hoc thuc|hoc com|hoc keo|hoc phai)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return /\b(bi nghen|dang nghen|nghen dac|mac di vat|mac xuong|mac thuc an|hac xuong|bi hac)\b/.test(
    folded,
  );
}

function matchStroke(folded: string): boolean {
  if (
    /\b(meo mieng|mieng meo|meo mom|mom meo|cuoi meo|liet mat|noi ngong|kho noi|noi kho|khong noi duoc|noi khong ro|dot quy|noi lap|mat lech|lech mieng|meo mat|noi do|noi liu|liu luoi)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(yeu|liet)\s+(nua|mot ben|nua nguoi)\b/.test(folded) ||
    /\bte liet\b/.test(folded) ||
    /\b(tay|chan)\s+(?:trai|phai|ben\s+)?khong\s+nhac\b/.test(folded) ||
    /\bkhong\s+nhac(?:\s+(?:len|noi|duoc)){0,2}\s+(?:tay|chan)\b/.test(folded) ||
    /\bkhong\s+nhac\s+len\s+duoc\b/.test(folded) ||
    (/\bkhong\s+cu\s+dong(?:\s+duoc)?\b/.test(folded) &&
      /\b(nua nguoi|mot ben|ben trai|ben phai)\b/.test(folded))
  ) {
    return true;
  }
  if (
    /\bte\b.{0,48}\b(mot ben|nua nguoi|ben trai|ben phai)\b/.test(folded) ||
    /\b(mot ben|nua nguoi|ben trai|ben phai)\b.{0,48}\bte\b/.test(folded)
  ) {
    return true;
  }
  // "nói không…" is not "nói khó". Require a stroke context for this phrasing.
  if (/\bnoi khong thanh cau\b/.test(folded)) {
    return /\b(dot nhien|dot ngot|meo mieng|mat lech|meo mat|liet|mot ben|nua nguoi|ben trai|ben phai|khong nhac|yeu nua|yeu mot)\b/.test(
      folded,
    );
  }
  return false;
}

function matchGated(
  question: string,
  accented: string,
  folded: string,
): Exclude<RiskClass, "none"> | null {
  if (matchChoking(question, accented, folded)) return "choking";
  if (/\b(co giat|len con co giat|len con dong kinh|sui bot mep)\b/.test(folded)) {
    return "seizure";
  }
  if (
    /\b(ngo doc|uong nham|qua lieu|overdose|thuoc tru sau|thuoc diet co|thuoc chuot|thuoc diet con trung|ca vi thuoc|uong ca vi|uong het vi|nuot ca vi|het vi thuoc)\b/.test(
      folded,
    )
  ) {
    return "poisoning";
  }
  if (/\bsoc phan ve\b/.test(folded) || /\bdi ung nang\b/.test(folded)) {
    return "severe_allergy";
  }
  const swelling = /\b(phu mat|phu moi|phu hong|sung hong|noi me|phat ban)\b/.test(
    folded,
  );
  const airway = /\b(kho tho|khong tho duoc|tho khong noi)\b/.test(folded);
  const allergen = /\b(di ung|ong dot|hai san|an tom)\b/.test(folded);
  if ((swelling && airway) || (allergen && (swelling || airway))) return "severe_allergy";
  if (
    /\b(ha duong huyet|ha duong mau|duong huyet thap|tut duong huyet|ha duong)\b/.test(
      folded,
    ) &&
    /\b(lu lan|lo mo|khong tinh|bat tinh|hon me|noi lung tung|khong nhan ra|mo hoi|ngat|xiu|run)\b/.test(
      folded,
    )
  ) {
    return "low_blood_sugar";
  }
  if (
    /\b(tho khong noi|khong tho noi|moi tim|tim moi|tim tai|ngat tho|khong tho duoc)\b/.test(
      folded,
    )
  ) {
    return "breathing";
  }
  if (
    /\bkho tho\b/.test(folded) &&
    /\b(nang|du doi|ngat|mo hoi|dot nhien|nua tieng|dang)\b/.test(folded)
  ) {
    return "breathing";
  }

  const headTrauma = /\b(dap dau|va dau|dau bi dap|bi dap dau)\b/.test(folded);
  const headSymptoms =
    /\b(lu lan|buon non|non|lo mo|hon me|khong tinh|mat y thuc)\b/.test(folded);
  if (headTrauma && headSymptoms) return "head_injury";

  if (/\b(bat tinh|mat y thuc|khong danh thuc|khong tinh lai)\b/.test(folded)) {
    return "unconscious";
  }
  if (hasTone(question) && (hasPhrase(accented, "ngất") || hasPhrase(accented, "xỉu"))) {
    return "unconscious";
  }
  if (!hasTone(question) && /\bxiu\b/.test(folded)) return "unconscious";
  if (!hasTone(question) && /\bngat\b/.test(folded) && !/\bngat tho\b/.test(folded)) {
    return "unconscious";
  }
  if (/\bngat xiu\b/.test(folded)) return "unconscious";
  if (/\bkhong tinh\b/.test(folded) && !/\bvan tinh\b/.test(folded)) return "unconscious";

  if (/\b(?:dau|tuc|that|nong|siet|nhoi|nang)\s+nguc\b/.test(folded)) return "chest_pain";

  if (matchStroke(folded)) return "stroke";

  const fell = hasActualFall(folded) || mentionsTe(question, accented);
  const hip = /\b(dau hong|dau khop hang|dau xuong hong|dau xuong chau)\b/.test(folded);
  if (cantStand(folded)) return "fall_emergency";
  if (fell && hip) return "fall_emergency";
  if (
    fell &&
    /\b(khong cu dong|khong nhac|te|liet|dap dau|lu lan|lo mo|buon non|mat y thuc)\b/.test(
      folded,
    )
  ) {
    return "fall_emergency";
  }

  if (
    /\b(non ra mau|oi ra mau|ho ra mau|di ngoai ra mau|ia ra mau|phan ra mau|dai ra mau|dai tien ra mau|tieu chay ra mau|phan den|chay mau nhieu|chay mau khong cam|chay mau khong dung|chay mau o at|xuat huyet nang|xuat huyet nhieu|mau chay nhieu|mau chay khong cam)\b/.test(
      folded,
    )
  ) {
    return "bleeding";
  }

  return null;
}

export const RED_FLAG_ADJACENT_LINE =
  "Nếu các dấu hiệu này đang xảy ra, hãy gọi 115 ngay.";

const ADJACENT_STEM =
  /\b(dau nguc|tuc nguc|that nguc|nhoi nguc|nang nguc|siet nguc|kho tho|tho khong noi|khong tho duoc|ngat tho|meo mieng|noi ngong|noi lap|mat lech|noi khong thanh cau|dot quy|chay mau|non ra mau|di ngoai ra mau|co giat|bat tinh|ngat xiu|dap dau|khong dung day|dau hong|dau khop hang|di ung nang|soc phan ve|ha duong|duong huyet thap|tut duong|thuoc tru sau|ca vi thuoc|uong ca vi|moi tim)\b/;

/** Symptom wording that missed the full emergency template. Abstention still names 115. */
export function isRedFlagAdjacent(question: string): boolean {
  const folded = normalizeSafetyText(question);
  if (ADJACENT_STEM.test(folded)) return true;
  if (!hasTone(question)) return false;
  const accented = accentedText(question);
  return (
    hasPhrase(accented, "hóc") ||
    hasPhrase(accented, "xỉu") ||
    hasPhrase(accented, "ngất")
  );
}

export function evaluateHighRisk(question: string): SafetyMatch {
  const folded = normalizeSafetyText(question);
  const accented = accentedText(question);
  const blocked = mildFallOnly(folded) || preventionOnly(folded);
  const riskClass = matchSelfHarm(question, accented, folded)
    ? "self_harm"
    : blocked
      ? null
      : matchGated(question, accented, folded);

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
