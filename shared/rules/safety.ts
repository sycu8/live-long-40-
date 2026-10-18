import { foldVietnamese } from "../utils/vietnamese";

export const SAFETY_RULESET_VERSION = "v1.6.0";

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

const TONE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

export type SafetyToken = {
  /** NFC lowercase. Telex tokens stay unaccented. */
  accented: string;
  folded: string;
  /** True only when this token itself carries a Vietnamese tone mark. */
  toned: boolean;
  /** True when a comma, stop, or newline separates this token from the previous one. */
  clauseStart: boolean;
};

/**
 * NFC, lowercase, diacritics stripped, telex tone letters expanded.
 * Used for patterns that do not collide after folding.
 */
export function normalizeSafetyText(question: string): string {
  return analyzeQuestion(question).folded;
}

function decodeTelexStem(token: string): string | null {
  // Tone letter is the last character. "meos" is méo; English clusters like "stress" are not.
  if (!/^[a-z]{2,}[sfrxj]$/.test(token) || token.length > 9) return null;
  const rawStem = token.slice(0, -1);
  if (!/[aeiouy]/.test(rawStem)) return null;
  if (/[bcdfghjklmnpqrstvwxyz]{3,}/.test(rawStem)) return null;
  let stem = rawStem;
  stem = stem.replace(/dd/g, "đ");
  stem = stem
    .replace(/aa/g, "â")
    .replace(/aw/g, "ă")
    .replace(/ee/g, "ê")
    .replace(/oo/g, "ô")
    .replace(/ow/g, "ơ")
    .replace(/uw/g, "ư");
  return stem;
}

const CLAUSE_BREAK = /[,;.!?…\n]/u;

export function analyzeQuestion(question: string): {
  tokens: SafetyToken[];
  folded: string;
  accented: string;
} {
  const source = question.normalize("NFC").toLowerCase();
  const tokens: SafetyToken[] = [];
  const wordRe = /[\p{L}\p{N}]+/gu;
  let match: RegExpExecArray | null;
  let lastEnd = 0;
  while ((match = wordRe.exec(source))) {
    const word = match[0];
    const gap = source.slice(lastEnd, match.index);
    const clauseStart = tokens.length === 0 || CLAUSE_BREAK.test(gap);
    lastEnd = match.index + word.length;
    const telex = decodeTelexStem(word);
    if (telex) {
      tokens.push({
        accented: word,
        folded: foldVietnamese(telex),
        toned: false,
        clauseStart,
      });
      continue;
    }
    tokens.push({
      accented: word,
      folded: foldVietnamese(word),
      toned: TONE.test(word),
      clauseStart,
    });
  }
  return {
    tokens,
    folded: tokens.map((token) => token.folded).join(" "),
    accented: source.replace(/\s+/g, " ").trim(),
  };
}

/**
 * A toned token must equal the accented word. An unaccented token must equal
 * the folded word. One accented token elsewhere does not disable the other.
 */
function hasPhrase(tokens: SafetyToken[], accentedPhrase: string): boolean {
  const words = accentedPhrase.split(/\s+/);
  const foldedWords = words.map((word) => foldVietnamese(word));
  for (let i = 0; i <= tokens.length - words.length; i++) {
    let ok = true;
    for (let j = 0; j < words.length; j++) {
      const token = tokens[i + j]!;
      if (token.toned) {
        if (token.accented !== words[j]) ok = false;
      } else if (token.folded !== foldedWords[j]) {
        ok = false;
      }
      if (!ok) break;
    }
    if (ok) return true;
  }
  return false;
}

function hasAnyPhrase(tokens: SafetyToken[], phrases: string[]): boolean {
  return phrases.some((phrase) => hasPhrase(tokens, phrase));
}

/**
 * Exact accent, missing tone, or a wrong tone on the same stem.
 * "từ" is the gradual word, not a mistyped "tự" or "tử".
 */
function matchesTarget(token: SafetyToken, accented: string): boolean {
  const folded = foldVietnamese(accented);
  if (token.folded !== folded) return false;
  if (!token.toned) return true;
  if (token.accented === accented) return true;
  if ((accented === "tự" || accented === "tử") && token.accented === "từ") return false;
  return true;
}

function nearFolded(
  tokens: SafetyToken[],
  index: number,
  words: string[],
  radius = 4,
): boolean {
  const start = Math.max(0, index - radius);
  const end = Math.min(tokens.length, index + radius + 1);
  for (let i = start; i < end; i++) {
    if (words.includes(tokens[i]!.folded)) return true;
  }
  return false;
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
      "Cho uống nước đường nếu còn tỉnh, nuốt được. Làm theo hướng dẫn của tổng đài 115.",
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

const INTENT = new Set(["toi", "em", "minh", "muon", "dinh", "tinh", "toan"]);
const SPEECH = new Set(["noi", "bao", "ke", "than", "hoi"]);
const FIRST_PERSON = new Set(["toi", "em", "minh"]);
const PLAN_VERBS = new Set(["muon", "dinh", "tinh", "toan"]);
/** The word directly before "muốn chết" when it is a plan, not an idiom. */
const LITERAL_BEFORE_DIE = new Set([
  "toi",
  "em",
  "minh",
  "dinh",
  "tinh",
  "toan",
  "noi",
  "bao",
  "ke",
  "than",
  "hoi",
  "se",
  "dang",
  "chi",
]);

function hasIntentFrame(tokens: SafetyToken[], index: number): boolean {
  return nearFolded(tokens, index, [...INTENT, ...SPEECH], 4);
}

function sameClause(tokens: SafetyToken[], from: number, to: number): boolean {
  for (let i = from + 1; i <= to; i++) {
    if (tokens[i]?.clauseStart) return false;
  }
  return true;
}

/**
 * Unaccented "tu tu" is a plan only when a first person and a plan verb
 * sit immediately in front of it, in the same clause.
 * "toi muon tu tu" counts. "toi muon, tu tu" and "toi muon di tu tu" do not.
 */
function adjacentTuTuPlan(tokens: SafetyToken[], tuIndex: number): boolean {
  const plan = tokens[tuIndex - 1];
  const person = tokens[tuIndex - 2];
  if (!plan || !person) return false;
  if (!sameClause(tokens, tuIndex - 2, tuIndex)) return false;
  return FIRST_PERSON.has(person.folded) && PLAN_VERBS.has(plan.folded);
}

function hasTightPersonalPlan(tokens: SafetyToken[]): boolean {
  for (let i = 0; i < tokens.length - 1; i++) {
    const first = tokens[i]!;
    const second = tokens[i + 1]!;
    const pair =
      (matchesTarget(first, "tự") && matchesTarget(second, "tử")) ||
      (matchesTarget(first, "tử") && matchesTarget(second, "tự"));
    if (pair && adjacentTuTuPlan(tokens, i)) return true;
    if (!matchesTarget(first, "muốn") || !matchesTarget(second, "chết")) continue;
    const person = tokens[i - 1];
    if (!person || !FIRST_PERSON.has(person.folded)) continue;
    if (!sameClause(tokens, i - 1, i + 1)) continue;
    return true;
  }
  return false;
}

/** Prevention and "what are the signs" questions, with no personal plan. */
function isSelfHarmInformation(folded: string): boolean {
  return /\b(phong ngua|de phong|ngan ngua|cach phong|lam sao phong|dau hieu|nhan biet|cach nhan|nguoi muon tu|nguoi dinh tu|nguoi muon chet)\b/.test(
    folded,
  );
}

/**
 * "muốn chết" is literal only when the previous word is a person, a speech verb,
 * or a plan verb. Any other predecessor is an exaggeration idiom
 * ("rét muốn chết", "chán muốn chết", "điên muốn chết").
 */
function isHyperboleWantDie(tokens: SafetyToken[], wantIndex: number): boolean {
  const prev = tokens[wantIndex - 1];
  if (!prev) return false;
  return !LITERAL_BEFORE_DIE.has(prev.folded);
}

function restContext(tokens: SafetyToken[], index: number): boolean {
  return nearFolded(
    tokens,
    index,
    ["nghi", "ngoi", "tap", "the", "duc", "an", "nhai", "cai", "tang", "cham", "dan"],
    3,
  );
}

function matchSelfHarm(tokens: SafetyToken[]): boolean {
  const joined = tokens.map((token) => token.folded).join(" ");
  if (isSelfHarmInformation(joined) && !hasTightPersonalPlan(tokens)) return false;
  if (/\bkhong muon song chung\b/.test(joined)) {
    /* living together is not suicidal ideation */
  } else if (hasAnyPhrase(tokens, ["không muốn sống", "không thiết sống", "chán sống"])) {
    return true;
  }

  if (hasPhrase(tokens, "muốn biến mất") || hasPhrase(tokens, "sống làm gì nữa")) {
    return true;
  }
  if (/\bdi cho roi\b/.test(joined) && /\b(muon|bao|noi|chi)\b/.test(joined)) return true;

  for (let i = 0; i < tokens.length - 1; i++) {
    const first = tokens[i]!;
    const second = tokens[i + 1]!;
    const pair =
      (matchesTarget(first, "tự") && matchesTarget(second, "tử")) ||
      (matchesTarget(first, "tử") && matchesTarget(second, "tự"));
    if (!pair) continue;
    if (restContext(tokens, i)) continue;
    // Unaccented "tu tu" is "từ từ" unless the plan is adjacent and first person.
    const bothUnaccented = !first.toned && !second.toned;
    if (bothUnaccented) {
      if (adjacentTuTuPlan(tokens, i)) return true;
      continue;
    }
    if (hasIntentFrame(tokens, i)) return true;
  }

  if (hasPhrase(tokens, "tự sát") || hasPhrase(tokens, "tự làm hại")) return true;

  for (let i = 0; i < tokens.length - 1; i++) {
    const want = tokens[i]!;
    const die = tokens[i + 1]!;
    if (!matchesTarget(want, "muốn") || !matchesTarget(die, "chết")) continue;
    if (isHyperboleWantDie(tokens, i)) continue;
    if (hasPhrase(tokens, "muốn chết cho xong")) return true;
    if (hasIntentFrame(tokens, i)) return true;
  }

  if (hasPhrase(tokens, "đi theo") && /\bcho xong\b/.test(joined)) return true;

  if (/\bket thuc tat ca\b/.test(joined)) {
    const at = joined.indexOf("ket thuc tat ca");
    const after = joined.slice(at + "ket thuc tat ca".length).trim();
    const next = after.split(" ")[0] ?? "";
    const debt = [
      "cac",
      "khoan",
      "no",
      "cong",
      "viec",
      "thoi",
      "quen",
      "du",
      "an",
      "bai",
    ];
    const rests = /\b(nghi|ngoi)\b/.test(after);
    if (
      !debt.includes(next) &&
      !rests &&
      /\b(muon|dinh|tinh|chet|song|thuoc ngu)\b/.test(joined)
    ) {
      return true;
    }
  }

  if (
    /\bthuoc ngu\b/.test(joined) &&
    /\b(khong day|ngu luon|tu tu|ket thuc|muon chet|ca vi|het vien|uong het)\b/.test(
      joined,
    )
  ) {
    return true;
  }

  // Methods need a first-person or reported-intent frame, not a nearby relative.
  if (
    /\b(treo co|nhay lau|nhay cau|nhay xuong cau|nhay xuong lau|nhay tu ban cong|nhay ban cong|cat co tay|rach co tay|rach tay|tu cat|tu rach)\b/.test(
      joined,
    ) &&
    /\b(muon|dinh|tinh|toan|se|toi|em|minh|noi|bao)\b/.test(joined)
  ) {
    return true;
  }
  if (
    /\b(uong thuoc chuot|uong thuoc diet chuot|uong thuoc diet)\b/.test(joined) &&
    /\b(muon|dinh|tinh|tu tu|tu sat|chet)\b/.test(joined)
  ) {
    return true;
  }

  // "chán đời" alone is an idiom. A self-harm hint beside it still counts.
  if (
    hasPhrase(tokens, "chán đời") &&
    /\b(muon chet|tu tu|khong muon song|bien mat|ket thuc|thuoc ngu|treo co)\b/.test(
      joined,
    )
  ) {
    return true;
  }

  return false;
}

function matchChoking(tokens: SafetyToken[], folded: string): boolean {
  if (
    /\b(mac nghen|bi nghen|dang nghen|nghen dac|nghen do|mac di vat|mac xuong|mac thuc)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    const isHoc =
      (token.toned && token.accented === "hóc") ||
      (!token.toned && token.folded === "hoc");
    if (!isHoc) continue;
    if (next && (next.accented === "môn" || next.folded === "mon")) continue;
    if (token.toned && token.accented === "học") continue;
    if (next && ["tieng", "boi", "lop", "bai", "sinh"].includes(next.folded)) continue;
    const context = nearFolded(
      tokens,
      i,
      ["bi", "dang", "xuong", "thuc", "ca", "keo", "banh", "com", "ho", "sac"],
      4,
    );
    if (
      token.toned &&
      token.accented === "hóc" &&
      (context || !next || next.folded !== "mon")
    ) {
      if (next?.folded === "mon") continue;
      if (context || /\b(bi|ho|xuong|thuc)\b/.test(folded)) return true;
    }
    if (!token.toned && context) return true;
  }
  if (/\b(ho sac|sac sua)\b/.test(folded) && /\b(hoc|nghen|xuong)\b/.test(folded))
    return true;
  return false;
}

function sugarContext(folded: string): boolean {
  return /\b(tieu duong|duong huyet|ha duong|tut duong|insulin|duong mau)\b/.test(folded);
}

function sugarSevere(folded: string): boolean {
  return /\b(lo mo|lu lan|noi lan|noi lap|run|va mo hoi|toat mo hoi|khong tinh|met la|hon me|bat tinh|mo hoi|hoa mat|tay run|bung doi|ngat|xiu)\b/.test(
    folded,
  );
}

function matchGlucose(folded: string): boolean {
  if (!sugarContext(folded) || !sugarSevere(folded)) return false;
  if (/\bduong huyet\b/.test(folded) && /\b(hi|lo|\d{2,3})\b/.test(folded)) return true;
  if (/\b(tieu duong|insulin|ha duong|tut duong|duong huyet)\b/.test(folded)) return true;
  return false;
}

function matchAllergy(folded: string): boolean {
  if (/\b(soc phan ve|phan ve|di ung nang)\b/.test(folded)) return true;
  const swelling =
    /\b(sung moi|sung luoi|sung hong|sung co|co sung|sung mat|mat sung|moi sung|sung phu|phu mat|phu moi|phu ne|noi man|me day|sung to)\b/.test(
      folded,
    );
  const airway = /\b(kho tho|tho kho khe|kho khe|khong tho|choang|mat tim)\b/.test(
    folded,
  );
  const trigger = /\b(ong dot|an tom|uong thuoc|thuoc xong|hai san|an xong)\b/.test(
    folded,
  );
  if (swelling && (airway || trigger)) return true;
  if (trigger && airway && /\b(sung|phu|man)\b/.test(folded)) return true;
  if (/\bme day\b/.test(folded) && /\b(khap nguoi|kho tho|sung)\b/.test(folded))
    return true;
  return false;
}

function matchChest(folded: string): boolean {
  if (/\b(dau|tuc|that|nhoi|nang|siet|de)\s+(?:\w+\s+){0,2}nguc\b/.test(folded))
    return true;
  if (/\bnguc\s+(?:\w+\s+){0,2}(dau|tuc|that|nhoi|nang|de|siet)\b/.test(folded))
    return true;
  if (/\b(con dau tim|dau tim|nhoi mau|dau that nguc)\b/.test(folded)) return true;
  return false;
}

function matchBreathing(folded: string): boolean {
  if (
    /\b(tho khong noi|khong tho noi|khong tho duoc|tho khong ra hoi|tho rit|tho hon hen|tho gap|tho doc|con hen nang|hen nang|len con hen|ngat tho|hut hoi|ngop tho|khong lay duoc hoi|ngung tho|suy ho hap|moi tim|tim tai|moi tai xanh|mat tim|tho ret)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(kho tho|tho kho khe)\b/.test(folded) &&
    /\b(nang|du doi|rit|hon hen|khong do|dot nhien|dang|nua tieng|qua|khong noi|tim tai|moi tim)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return false;
}

function matchSeizure(folded: string): boolean {
  if (
    /\b(lam sao phong|phong ngua|de phong|ngan ngua|cach phong)\b/.test(folded) &&
    !/\b(dang giat|giat lien|giat khong|lien tuc|sui bot|co cung|cung nguoi|bat tinh|len con)\b/.test(
      folded,
    )
  ) {
    return false;
  }
  if (
    /\b(hay co giat|hay bi co giat|hay giat)\b/.test(folded) &&
    !/\b(dang|lien tuc|khong dung|sui bot|cung nguoi|co cung)\b/.test(folded)
  ) {
    return false;
  }
  if (
    /\b(sui bot mep|co cung|cung nguoi|cung do|giat lien tuc|giat khong dung|dang giat)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (/\b(len con dong kinh|len con co giat|len con giat)\b/.test(folded)) return true;
  if (/\bco giat\b/.test(folded)) return true;
  if (
    /\bdong kinh\b/.test(folded) &&
    /\b(dang|len con|giat|sui bot|co cung|cung nguoi|bat tinh|lien tuc)\b/.test(folded)
  ) {
    return true;
  }
  return false;
}

function matchPoison(folded: string): boolean {
  return /\b(uong nham|qua lieu|ngo doc|thuoc tru sau|thuoc diet co|thuoc diet chuot|thuoc chuot|ca vi thuoc|uong ca vi|uong het vi|het vi thuoc|uong het thuoc)\b/.test(
    folded,
  );
}

function matchBleeding(folded: string): boolean {
  // "có làm … không?" asks whether something can bleed. It is not bleeding now.
  if (
    /\bco lam\b/.test(folded) &&
    /\bkhong\b/.test(folded) &&
    !/\b(dang|vua|khong cam|o at|khong dung)\b/.test(folded)
  ) {
    return false;
  }
  return /\b(chay mau nhieu|chay mau khong cam|chay mau khong ngung|chay mau o at|chay mau khong dung|mau khong ngung|mau khong cam|cam mau khong|non ra mau|non mau|oi ra mau|di ngoai ra mau|di cau ra mau|ia ra mau|ho ra mau|dai tien ra mau|xuat huyet nang|mau chay nhieu|mau chay khong|mau tuoi|mau thanh dong|chay thanh dong)\b/.test(
    folded,
  );
}

const FAINT_IDIOM = new Set(["chet", "cuoi", "so", "muon"]);

function realFaintSign(folded: string): boolean {
  return /\b(bat tinh|mat y thuc|khong danh thuc|khong tinh lai|lim di|khong phan ung|goi khong tra loi|nam im|goi khong tinh|khong day|khong tinh)\b/.test(
    folded,
  );
}

function isFaintWord(token: SafetyToken, next: SafetyToken | undefined): boolean {
  if (next?.folded === "tho" && token.folded === "ngat") return false;
  if (token.toned && (token.accented === "ngất" || token.accented === "xỉu")) return true;
  if (token.toned && token.accented === "ngạt") return false;
  return !token.toned && (token.folded === "ngat" || token.folded === "xiu");
}

/** "chết ngất", "cười ngất", "sợ ngất", "muốn ngất" are idioms, not a collapse. */
function isFaintIdiomToken(tokens: SafetyToken[], index: number): boolean {
  const token = tokens[index]!;
  const prev = tokens[index - 1];
  const next = tokens[index + 1];
  const prevHit = Boolean(prev && !token.clauseStart && FAINT_IDIOM.has(prev.folded));
  const nextHit = Boolean(next && !next.clauseStart && FAINT_IDIOM.has(next.folded));
  return prevHit || nextHit;
}

function faintIdiomOnly(tokens: SafetyToken[]): boolean {
  let saw = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!isFaintWord(token, tokens[i + 1])) continue;
    if (!isFaintIdiomToken(tokens, i)) return false;
    saw = true;
  }
  return saw;
}

function matchUnconscious(tokens: SafetyToken[], folded: string): boolean {
  if (
    /\b(bat tinh|mat y thuc|khong danh thuc|khong tinh lai|lim di|khong phan ung|goi khong tra loi|nam im|goi khong tinh|khong day)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (/\bkhong tinh\b/.test(folded) && !/\bvan tinh\b/.test(folded)) return true;
  if (faintIdiomOnly(tokens) && !realFaintSign(folded)) return false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!isFaintWord(token, tokens[i + 1])) continue;
    if (isFaintIdiomToken(tokens, i) && !realFaintSign(folded)) continue;
    return true;
  }
  return false;
}

function matchHead(folded: string): boolean {
  const trauma = /\b(dap dau|va dau|bi dap dau|dau bi dap)\b/.test(folded);
  const afterFall =
    /\b(nga|te)\b/.test(folded) && /\b(dau dau|oi|non|buon non)\b/.test(folded);
  const signs =
    /\b(lu lan|lan lon|buon non|non|oi|lo mo|lu du|hon me|khong tinh|khong nhan ra)\b/.test(
      folded,
    );
  if (trauma && signs) return true;
  if (afterFall && signs) return true;
  return false;
}

function matchStroke(folded: string): boolean {
  if (/\bnoi kho nghe\b/.test(folded)) {
    /* hard of hearing, not aphasia */
  } else if (/\bnoi kho\b/.test(folded) && !/\bnen tap\b/.test(folded)) {
    return true;
  }
  if (
    /\b(meo mieng|mieng meo|meo mom|meo mep|noi ngong|noi khong ra|noi khong ro|mat lech|lech mieng|meo mat|mieng lech|noi lap|xe mot ben mat|xe mat|noi dot|noi u o|te nua mat|nhin mo dot|cuoi meo|liet mat|yeu mot ben|yeu nua|yeu han|liet nua|liet mot ben)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(yeu|liet)\s+(han\s+|het\s+)?(nua|mot ben|nua nguoi|tay|chan)\b/.test(folded) ||
    /\bte liet\b/.test(folded)
  ) {
    return true;
  }
  if (
    /\b(tay|chan)\s+(?:trai|phai\s+)?khong\s+nhac\b/.test(folded) ||
    /\bkhong\s+nhac(?:\s+(?:len|noi|duoc)){0,2}\s+(?:tay|chan)\b/.test(folded)
  ) {
    return true;
  }
  if (
    /\bte\s+nua\s+mat\b/.test(folded) ||
    (/\bte\b/.test(folded) &&
      /\b(mot ben|nua nguoi|nua mat)\b/.test(folded) &&
      !/\bnga\b/.test(folded))
  ) {
    return true;
  }
  if (
    /\bnoi khong thanh cau\b/.test(folded) &&
    /\b(dot nhien|meo|lech|yeu|liet|mat)\b/.test(folded)
  ) {
    return true;
  }
  if (/\bdot quy\b/.test(folded) && /\b(dang|vua|bi|tu nhien|dot nhien)\b/.test(folded)) {
    return true;
  }
  return false;
}

function fell(tokens: SafetyToken[], folded: string): boolean {
  if (tokens.some((token) => token.toned && token.accented === "té")) return true;
  if (
    /\b(bi nga|vua nga|nga cau|nga xuong|nga trong|truot chan|truot nga|nga)\b/.test(
      folded,
    )
  )
    return true;
  // Unaccented "te" may be "té". It counts only with a separate injury, so "tê tay" stays quiet.
  const bareTe = tokens.some((token) => !token.toned && token.folded === "te");
  if (!bareTe) return false;
  return /\b(khong dung|khong cu dong|khong di duoc|chan lech|dau hang|dau hong|dap dau)\b/.test(
    folded,
  );
}

function matchFall(tokens: SafetyToken[], folded: string): boolean {
  const down = fell(tokens, folded);
  const mild = /\bnga nhe\b/.test(folded) && /\b(van tinh|tinh tao)\b/.test(folded);
  const numb = tokens.some(
    (token) =>
      (token.toned && token.accented === "tê") ||
      (!token.toned &&
        token.folded === "te" &&
        !tokens.some((other) => other.toned && other.accented === "té")),
  );
  const red =
    numb ||
    /\b(khong dung|khong cu dong|khong di duoc|chan lech|dau hang|dau hong|dau lung|dau khop hang|liet|lech|khong nhac|gay xuong|dap dau)\b/.test(
      folded,
    );
  const prevention =
    /\b(phong te|phong nga|phong ngua|de phong|ngan ngua|tranh te|tranh nga|lam sao phong)\b/.test(
      folded,
    );
  const fallEvent =
    /\b(vua|dang|roi|khong dung|dap dau|chan lech|dau hang|dau hong|gay|chay mau)\b/.test(
      folded,
    );
  if (!down || (prevention && !fallEvent)) return false;
  if (mild && !/\b(khong dung|khong cu dong|dap dau|chay mau)\b/.test(folded))
    return false;
  if (/\bkhong\s+(?:tu\s+|the\s+)?dung\s+(?:day|len)(?:\s+duoc)?\b/.test(folded))
    return true;
  if (red) return true;
  return false;
}

function hasSpecificPerson(folded: string): boolean {
  // "cô"/"có", "dì"/"đi", and "chị"/"chỉ" share a folded stem, so they are not people here.
  return /\b(toi|chung toi|em|minh|bo|ba|me|ma|cha|ong|anh|chu|cu|vo|chong|con|chau|nguoi nha|benh nhan)\b/.test(
    folded,
  );
}

function isSudden(folded: string): boolean {
  return /\b(dang|vua|bong|dot nhien|dot ngot|tu nhien|tu dung|du doi|lien tuc|nua tieng|tu sang|luc nay|len con|va mo hoi|toat mo hoi|bat tinh|mat y thuc|lo mo|khong tinh|lim di|khong phan ung|sui bot|khong dung day|dap dau)\b/.test(
    folded,
  );
}

/** History, stable management, prevention, or a definition. Not a live event. */
function isPastOrStable(folded: string): boolean {
  const years = /\b(lau nam|nhieu nam)\b/.test(folded);
  const currentComplaint =
    /\b(tuc nguc|dau nguc|that nguc|nhoi nguc|kho tho|du doi|va mo hoi|toat mo hoi|lo mo|khong tinh|bat tinh|co giat|meo mieng|noi ngong|mat lech|chay mau|non ra mau|sui bot|uong nham|qua lieu|ngo doc|ca vi|uong het|thuoc tru sau|thuoc diet)\b/.test(
      folded,
    );
  if (years && !currentComplaint) return true;
  return /\b(nam truoc|ngay xua|tung bi|nam ngoai|on dinh|dinh ky|khi gang suc|nen tap|nen an|vat ly tri lieu|uong thuoc deu|hay kho tho|hay co giat|phong te nga|phong te|phong nga|phong ngua|de phong|ngan ngua|de khoi|de tranh|cach so cuu|hoc so cuu|co nen hoc|co phai dau hieu|dau hieu\b.{0,40}\bla gi\b|sau khi bi|sau khi mo|sau khi xuat|bao lau|da khoi)\b/.test(
    folded,
  );
}

function hasHardClinical(folded: string): boolean {
  return /\b(meo mieng|mieng meo|noi ngong|noi dot|noi u o|xe mot ben|xe mat|yeu nua|yeu mot|liet nua|liet mot|mat lech|mieng lech|lech mieng|te nua mat|co giat|dang giat|giat lien|co cung|cung nguoi|dau nguc|tuc nguc|that nguc|nhoi nguc|siet nguc|kho tho|hen nang|chay mau|non ra mau|oi ra mau|di ngoai ra mau|mac nghen|bi nghen|bi hoc|ngat tho|khong tho|tho khong|du doi|bat tinh|lo mo|khong tinh|sui bot|len con)\b/.test(
    folded,
  );
}

/** Frames that can hide a topic word only when nothing acute is happening. */
function hasEducationFrame(folded: string): boolean {
  return /\b(co sao khong|co nguy hiem khong|co hai khong|co phai|cham soc|co nen|phong|nen tap|nen an|dinh ky|on dinh|dau hieu|cach so cuu|khi gang suc|vat ly tri lieu|uong thuoc deu|ngay xua|nam truoc|co de bi|co tot khong|de khong|tranh bi|tranh hoc)\b/.test(
    folded,
  );
}

/**
 * Question frames cancel a topic only when no acute picture is present.
 * A live sign, a sudden change, or a named person with that sign always wins.
 */
function isEducation(folded: string): boolean {
  const sudden = isSudden(folded);
  const past = isPastOrStable(folded);
  const hard = hasHardClinical(folded);
  if (past && !sudden) return true;
  if (sudden || (hard && hasSpecificPerson(folded))) return false;
  if (
    hasSpecificPerson(folded) &&
    /\b(qua lieu|uong nham|ngo doc|ca vi|thuoc tru sau|thuoc diet)\b/.test(folded)
  ) {
    return false;
  }
  if (hard && !/\b(hoc so cuu|co nen hoc|cach so cuu|co phai dau hieu)\b/.test(folded)) {
    return false;
  }
  return hasEducationFrame(folded);
}

export const SYMPTOM_SAFETY_LINE = "Nếu có dấu hiệu nguy hiểm, gọi ngay 115.";

/** One line, not the crisis screen. Used only when the classifier is unsure. */
export const GENTLE_SUPPORT_LINE =
  "Nếu bạn đang thấy quá sức, bạn có thể gọi đường dây hỗ trợ 1900 1267.";

const SYMPTOM_ACCENTED = [
  "đau",
  "nhức",
  "ngực",
  "ngã",
  "té",
  "tê",
  "thở",
  "mệt",
  "nóng",
  "ho",
  "chóng",
  "sốt",
  "nôn",
  "ói",
  "máu",
  "choáng",
  "sưng",
  "phù",
  "giật",
  "lịm",
  "run",
  "ngất",
  "xỉu",
  "nghẹn",
  "liệt",
  "lệch",
  "ngọng",
  "méo",
  "ngứa",
  "mẩn",
  "tím",
  "tái",
  "yếu",
  "rít",
  "cứng",
  "toát",
  "hóc",
];

const SYMPTOM_WORDS = new Set(SYMPTOM_ACCENTED);
// "hóc" folds to "hoc", the same stem as "học", so only the accented word counts.
const SYMPTOM_FOLDED = new Set(
  SYMPTOM_ACCENTED.filter((word) => word !== "hóc").map((word) => foldVietnamese(word)),
);

/** Tone mark only. Vowel quality (â, ơ, đ) stays, so "dâu" does not become "đau". */
const TONE_TO_BASE: Record<string, string> = {
  à: "a",
  á: "a",
  ả: "a",
  ã: "a",
  ạ: "a",
  ằ: "ă",
  ắ: "ă",
  ẳ: "ă",
  ẵ: "ă",
  ặ: "ă",
  ầ: "â",
  ấ: "â",
  ẩ: "â",
  ẫ: "â",
  ậ: "â",
  è: "e",
  é: "e",
  ẻ: "e",
  ẽ: "e",
  ẹ: "e",
  ề: "ê",
  ế: "ê",
  ể: "ê",
  ễ: "ê",
  ệ: "ê",
  ì: "i",
  í: "i",
  ỉ: "i",
  ĩ: "i",
  ị: "i",
  ò: "o",
  ó: "o",
  ỏ: "o",
  õ: "o",
  ọ: "o",
  ồ: "ô",
  ố: "ô",
  ổ: "ô",
  ỗ: "ô",
  ộ: "ô",
  ờ: "ơ",
  ớ: "ơ",
  ở: "ơ",
  ỡ: "ơ",
  ợ: "ơ",
  ù: "u",
  ú: "u",
  ủ: "u",
  ũ: "u",
  ụ: "u",
  ừ: "ư",
  ứ: "ư",
  ử: "ư",
  ữ: "ư",
  ự: "ư",
  ỳ: "y",
  ý: "y",
  ỷ: "y",
  ỹ: "y",
  ỵ: "y",
};

function stripTone(word: string): string {
  let out = "";
  for (const ch of word) out += TONE_TO_BASE[ch] ?? ch;
  return out;
}

const SYMPTOM_BASE = new Set(SYMPTOM_ACCENTED.map((word) => stripTone(word)));

const SYMPTOM_PHRASES =
  /\b(kho tho|dau nguc|tuc nguc|that nguc|nhoi nguc|buon non|chong mat|hoa mat|lo mo|lu lan|duong huyet|tieu duong|chay mau|meo mieng|co giat|co cung|bat tinh|mat ngu|kho ngu|tieu chay|tao bon|me day|phu ne|dau dau|dau bung|dau lung|dau hong|dau khop|sung khop|kho tieu|sut can|chan an|met moi|toat mo hoi|va mo hoi|noi man|tim tai|hut hoi|ngop tho|non oi|mat suc|te bi|ngu khong ngon|noi me day|sung phu|kho khe)\b/;

export function questionMentionsSymptom(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (SYMPTOM_PHRASES.test(folded)) return true;
  return tokens.some((token) => {
    if (token.toned && SYMPTOM_WORDS.has(token.accented)) return true;
    // "họ" is only a tone away from "ho", and it is not a cough.
    if (token.accented === "họ") return false;
    if (token.toned) return SYMPTOM_BASE.has(stripTone(token.accented));
    return SYMPTOM_FOLDED.has(token.folded);
  });
}

/** @deprecated Use questionMentionsSymptom. Kept so callers can ask about a near miss. */
export function isRedFlagAdjacent(question: string): boolean {
  return questionMentionsSymptom(question) && !evaluateHighRisk(question).matched;
}

function chestPainPicture(folded: string): boolean {
  if (!matchChest(folded)) return false;
  return /\b(va mo hoi|toat mo hoi|mo hoi lanh|lan ra|lan xuong|lan sang|canh tay|ham duoi|con dau tim)\b/.test(
    folded,
  );
}

/** Dyspnea cues that should beat poison, fainting, or choking when those co-occur. */
function breathingSignal(folded: string): boolean {
  if (matchBreathing(folded)) return true;
  return /\b(tho nong|tho yeu|tho kho|kho tho|moi tim|tim tai|tim moi|khong hit|hit kho|ngop tho|hut hoi)\b/.test(
    folded,
  );
}

function allergySignal(folded: string): boolean {
  if (matchAllergy(folded)) return true;
  if (/\b(soc phan ve|phan ve)\b/.test(folded)) return true;
  const marker =
    /\b(di ung|sung moi|sung luoi|sung hong|sung co|phu moi|phu mat|moi sung|noi man|me day|noi me day)\b/.test(
      folded,
    );
  return (
    marker && /\b(kho tho|khong tho|choang|ngat|xiu|bat tinh|khong tinh)\b/.test(folded)
  );
}

function seizureSignal(folded: string): boolean {
  if (matchSeizure(folded)) return true;
  if (
    /\b(phong ngua|de phong|ngan ngua|cach phong|lam sao phong)\b/.test(folded) &&
    !/\b(dang giat|giat lien|sui bot|co cung|giat khong)\b/.test(folded)
  ) {
    return false;
  }
  return /\b(co giat|sui bot|co cung|giat khong|dang giat|len con|dong kinh)\b/.test(
    folded,
  );
}

function onlyHyperboleSelfHarm(tokens: SafetyToken[]): boolean {
  let saw = false;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!matchesTarget(tokens[i]!, "muốn") || !matchesTarget(tokens[i + 1]!, "chết"))
      continue;
    saw = true;
    if (!isHyperboleWantDie(tokens, i)) return false;
  }
  return saw && !hasTightPersonalPlan(tokens);
}

/**
 * Breathing, seizure, allergy, and low sugar win over poisoning and unconscious.
 * A chest-pain picture with sweating or pain spreading to the arm stays chest pain.
 * Education and stable history do not become a full screen from the classifier.
 */
export function refineClassifierRisk(
  question: string,
  modelClass: Exclude<RiskClass, "none">,
): Exclude<RiskClass, "none"> | null {
  const { tokens, folded } = analyzeQuestion(question);
  if (modelClass === "self_harm") {
    if (isSelfHarmInformation(folded) && !hasTightPersonalPlan(tokens)) return null;
    if (onlyHyperboleSelfHarm(tokens)) return null;
    return "self_harm";
  }
  if (modelClass === "unconscious" && faintIdiomOnly(tokens) && !realFaintSign(folded)) {
    return null;
  }
  if ((isEducation(folded) || isPastOrStable(folded)) && !isSudden(folded)) return null;

  const lower =
    modelClass === "poisoning" ||
    modelClass === "unconscious" ||
    modelClass === "choking" ||
    modelClass === "chest_pain";
  if (
    allergySignal(folded) &&
    (modelClass === "poisoning" ||
      modelClass === "unconscious" ||
      modelClass === "chest_pain")
  ) {
    return "severe_allergy";
  }
  if (
    (matchGlucose(folded) ||
      (sugarContext(folded) &&
        /\b(ngat|xiu|bat tinh|khong tinh|lo mo|hon me)\b/.test(folded))) &&
    (modelClass === "poisoning" || modelClass === "unconscious")
  ) {
    return "low_blood_sugar";
  }
  if (
    seizureSignal(folded) &&
    (modelClass === "poisoning" || modelClass === "unconscious")
  ) {
    return "seizure";
  }
  if (breathingSignal(folded) && !chestPainPicture(folded) && lower) return "breathing";
  return modelClass;
}

function pickRiskClass(
  tokens: SafetyToken[],
  folded: string,
): Exclude<RiskClass, "none"> | null {
  if (matchSelfHarm(tokens)) return "self_harm";
  const poison = matchPoison(folded);
  const unconscious = matchUnconscious(tokens, folded);
  const chest = matchChest(folded);
  const choking = matchChoking(tokens, folded);
  const breathing = matchBreathing(folded);
  const chestPicture = chestPainPicture(folded);
  if (
    matchAllergy(folded) ||
    (allergySignal(folded) && (poison || unconscious || chest))
  ) {
    return "severe_allergy";
  }
  if (
    matchGlucose(folded) ||
    (sugarContext(folded) &&
      /\b(ngat|xiu|bat tinh|khong tinh|lo mo|hon me)\b/.test(folded) &&
      (poison || unconscious || matchGlucose(folded)))
  ) {
    return "low_blood_sugar";
  }
  if (matchSeizure(folded) || (seizureSignal(folded) && (poison || unconscious))) {
    return "seizure";
  }
  if (breathing && !chestPicture) return "breathing";
  if (choking) return "choking";
  if (chest) return "chest_pain";
  if (breathing) return "breathing";
  if (breathingSignal(folded) && !chestPicture && (poison || unconscious)) {
    return "breathing";
  }
  if (poison) return "poisoning";
  if (matchBleeding(folded)) return "bleeding";
  if (matchHead(folded)) return "head_injury";
  if (unconscious) return "unconscious";
  if (matchStroke(folded)) return "stroke";
  if (matchFall(tokens, folded)) return "fall_emergency";
  return null;
}

export function evaluateHighRisk(question: string): SafetyMatch {
  const { tokens, folded } = analyzeQuestion(question);
  let riskClass = pickRiskClass(tokens, folded);

  if (riskClass && riskClass !== "self_harm" && isEducation(folded)) riskClass = null;

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

export function emergencyMessage(riskClass: Exclude<RiskClass, "none">): string {
  return MESSAGES[riskClass];
}

/**
 * Wording that might be self-harm or might be an idiom.
 * The fast path did not take the crisis screen. The classifier decides.
 */
export function selfHarmLooksInformational(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (hasTightPersonalPlan(tokens)) return false;
  if (evaluateHighRisk(question).riskClass === "self_harm") return false;
  return isSelfHarmInformation(folded);
}

export function selfHarmLooksAmbiguous(question: string): boolean {
  if (evaluateHighRisk(question).riskClass === "self_harm") return false;
  if (selfHarmLooksInformational(question)) return false;
  const { tokens, folded } = analyzeQuestion(question);
  if (/\b(muon chet|chan doi)\b/.test(folded)) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    const first = tokens[i]!;
    const second = tokens[i + 1]!;
    if (first.toned || second.toned) continue;
    if (first.folded !== "tu" || second.folded !== "tu") continue;
    if (restContext(tokens, i)) continue;
    if (adjacentTuTuPlan(tokens, i)) continue;
    // A plan verb in the neighborhood, but not the adjacent first-person form.
    if (nearFolded(tokens, i, ["muon", "dinh", "tinh", "toan"], 4)) return true;
  }
  return false;
}
