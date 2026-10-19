import { foldVietnamese } from "../utils/vietnamese";

export const SAFETY_RULESET_VERSION = "v1.8.9";

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
  | "burn"
  | "urgent"
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
      "Ở lại bên cạnh, cất thuốc và vật sắc, và giữ cuộc gọi 115 cho đến khi có người đến.",
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
  burn: advice(
    [
      "Gọi 115 ngay và nói rõ bỏng do nước sôi, lửa, điện hay hóa chất.",
      "Nếu an toàn, ngừng tiếp xúc với nguồn gây bỏng và ở bên cạnh người bệnh.",
    ],
    [
      "Không bôi kem đánh răng, dầu ăn, hoặc thuốc không rõ nguồn.",
      "Không làm vỡ chỗ phồng rộp.",
    ],
  ),
  urgent: advice(
    [
      "Gọi 115 ngay và nói rõ đang xảy ra chuyện gì.",
      "Ở bên cạnh và làm theo hướng dẫn của tổng đài 115.",
    ],
    ["Không bỏ mặc một mình.", "Không tự cho thuốc."],
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

/**
 * Accented tự tử / tự sát, or an unaccented "tu tu" only with the adjacent plan.
 * Unaccented "từ từ" (slowly) is neither.
 */
function suicidePairKind(
  tokens: SafetyToken[],
  index: number,
): "real" | "adjacent" | null {
  const first = tokens[index];
  const second = tokens[index + 1];
  if (!first || !second) return null;
  const methodPair =
    (matchesTarget(first, "tự") && matchesTarget(second, "sát")) ||
    (matchesTarget(first, "tự") && matchesTarget(second, "vẫn")) ||
    (matchesTarget(first, "tự") && matchesTarget(second, "hại"));
  if (methodPair) return "real";
  const tuTu =
    (matchesTarget(first, "tự") && matchesTarget(second, "tử")) ||
    (matchesTarget(first, "tử") && matchesTarget(second, "tự"));
  if (!tuTu) return null;
  if (first.toned || second.toned) return "real";
  if (adjacentTuTuPlan(tokens, index)) return "adjacent";
  return null;
}

function hasRealSuicidePair(tokens: SafetyToken[]): boolean {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (suicidePairKind(tokens, i) === "real") return true;
  }
  return false;
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

const INFO_FRAME =
  /\b(phong ngua|de phong|ngan ngua|cach phong|lam sao phong|dau hieu|nhan biet|cach nhan)\b/;
const PAST_SELF_HARM =
  /\b(tung|truoc day|truoc kia|hoi truoc|hoi do|ngay xua|luc truoc|nam truoc|da qua|bay gio on|gio thi on|da on|on roi)\b/;
const HET_SYMPTOM = new Set([
  "dau",
  "giat",
  "chay",
  "mau",
  "tho",
  "nguc",
  "sot",
  "sung",
  "ngat",
  "meo",
  "pain",
  "chest",
]);

function foldedAt(tokens: SafetyToken[], index: number): string {
  return tokens[index]?.folded ?? "";
}

/** Accented tự tử / tự sát, or an unaccented pair only with an adjacent plan. */
function hasSelfHarmTopic(tokens: SafetyToken[], joined: string): boolean {
  if (
    /\b(tu sat|tu hai|tu van|quyen sinh|tuyet menh|ket lieu doi|ket lieu cuoc|khong muon song|chang muon song|khong thiet song)\b/.test(
      joined,
    )
  ) {
    return true;
  }
  if (/\bmuon chet\b/.test(joined)) {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (!matchesTarget(tokens[i]!, "muốn") || !matchesTarget(tokens[i + 1]!, "chết"))
        continue;
      if (!isHyperboleWantDie(tokens, i)) return true;
    }
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const first = tokens[i]!;
    const second = tokens[i + 1]!;
    if (first.folded !== "tu" || second.folded !== "tu") continue;
    if (restContext(tokens, i)) continue;
    const bothUnaccented = !first.toned && !second.toned;
    if (!bothUnaccented) return true;
    if (adjacentTuTuPlan(tokens, i)) return true;
  }
  if (
    /\b(nhay cau|nhay lau|nhay xuong|treo co|rach co tay|cat co tay)\b/.test(joined) &&
    /\b(muon|dinh|tinh|toan|se|sap)\b/.test(joined)
  ) {
    return true;
  }
  return classBasedSelfHarm(tokens, joined) || intentPlusMethod(tokens, joined);
}

function hasCurrentSelfHarmPlan(tokens: SafetyToken[], joined: string): boolean {
  if (/\b(toi nay|dem nay|ngay bay gio)\b/.test(joined)) return true;
  if (/\bdang dinh\b/.test(joined)) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (suicidePairKind(tokens, i) !== "real") continue;
    const prev = tokens[i - 1];
    if (!prev || (prev.folded !== "sap" && prev.folded !== "se")) continue;
    if (sameClause(tokens, i - 1, i)) return true;
  }
  return false;
}

/**
 * "không còn" / "chẳng còn" is a settled past only when the next word is the
 * plan itself. "không còn sức" does not cancel a later "muốn chết".
 */
function negatesCurrentPlan(tokens: SafetyToken[]): boolean {
  for (let i = 0; i < tokens.length - 2; i++) {
    const token = tokens[i]!;
    if (foldedAt(tokens, i + 1) !== "con") continue;
    const negator =
      token.folded === "khong" ||
      (token.folded === "chang" && (!token.toned || token.accented === "chẳng")) ||
      (token.folded === "cha" && token.toned && token.accented === "chả");
    if (!negator) continue;
    const next = tokens[i + 2]!;
    if (next.clauseStart) continue;
    if (["muon", "nghi", "dinh", "tinh", "tu"].includes(next.folded)) return true;
  }
  return false;
}

function selfHarmIsPastStable(tokens: SafetyToken[], joined: string): boolean {
  if (hasCurrentSelfHarmPlan(tokens, joined)) return false;
  if (!PAST_SELF_HARM.test(joined) && !negatesCurrentPlan(tokens)) return false;
  return hasSelfHarmTopic(tokens, joined);
}

/** Prevention and "what are the signs" questions, with a self-harm topic and no personal plan. */
function isSelfHarmInformation(tokens: SafetyToken[], joined: string): boolean {
  if (!hasSelfHarmTopic(tokens, joined)) return false;
  return INFO_FRAME.test(joined);
}

function isSimpleNegator(token: SafetyToken): boolean {
  if (token.folded === "khong" || token.folded === "chua") return true;
  if (token.folded === "no" || token.folded === "not" || token.folded === "never")
    return true;
  if (token.folded === "chang") return !token.toned || token.accented === "chẳng";
  if (token.folded === "cha") return token.toned && token.accented === "chả";
  return false;
}

/** Words that stay visible because "không" is the symptom, not a denial. */
function inabilityKeep(tokens: SafetyToken[]): Set<number> {
  const keep = new Set<number>();
  const mark = (index: number, count: number) => {
    for (let offset = 0; offset < count && index + offset < tokens.length; offset++) {
      keep.add(index + offset);
    }
  };
  for (let i = 0; i < tokens.length; i++) {
    const a = foldedAt(tokens, i);
    const b = foldedAt(tokens, i + 1);
    const c = foldedAt(tokens, i + 2);
    const d = foldedAt(tokens, i + 3);
    if (a === "khong" && b === "tho") {
      let count = 2;
      if (c === "duoc" || c === "noi" || c === "ra") count = 3;
      if (c === "ra" && d === "hoi") count = 4;
      mark(i, count);
    }
    if (a === "tho" && b === "khong") {
      let count = 2;
      if (c === "noi" || c === "duoc" || c === "ra") count = 3;
      mark(i, count);
    }
    if (a === "khong" && b === "dung") {
      let count = 2;
      if (c === "day" || c === "len" || c === "duoc") count = 3;
      mark(i, count);
    }
    if (a === "khong" && (b === "tu" || b === "the") && c === "dung") {
      let count = 3;
      if (d === "day" || d === "len" || d === "duoc") count = 4;
      mark(i, count);
    }
    if (a === "khong" && b === "hit") mark(i, 2);
    if (a === "ngung" && b === "tho") mark(i, 2);
    if (a === "khong" && b === "lay" && c === "duoc" && d === "hoi") mark(i, 4);
    if (
      (a === "khong" ||
        a === "chang" ||
        (a === "cha" && tokens[i]?.accented === "chả")) &&
      b === "muon" &&
      c === "song" &&
      d !== "chung"
    ) {
      mark(i, 3);
    }
    if (a === "khong" && b === "thiet" && c === "song") mark(i, 3);
    if (
      (a === "khong" ||
        a === "chang" ||
        (a === "cha" && tokens[i]?.accented === "chả")) &&
      b === "song" &&
      c === "noi" &&
      d !== "tieng"
    ) {
      mark(i, 3);
    }
    if (a === "khong" && b === "the" && c === "song" && d === "noi") mark(i, 4);
    if (a === "khong" && b === "con" && c === "song" && d === "noi") mark(i, 4);
    if (a === "song" && b === "khong" && c === "noi" && d !== "tieng") mark(i, 3);
    if (a === "khong" && (b === "tinh" || b === "day")) mark(i, 2);
    if (a === "khong" && b === "phan" && c === "ung") mark(i, 3);
    if (a === "khong" && b === "cam" && c === "mau") mark(i, 3);
    if (a === "mau" && b === "khong" && (c === "cam" || c === "dung" || c === "ngung"))
      mark(i, 3);
    if (a === "cam" && b === "mau" && c === "khong") mark(i, 3);
    if (a === "chay" && b === "mau" && c === "khong") mark(i, 4);
    if (a === "giat" && b === "khong" && (c === "ngung" || c === "dung")) mark(i, 3);
    if (a === "khong" && b === "cu" && c === "dong") mark(i, 3);
    if (a === "khong" && b === "nhac") mark(i, 2);
    if (a === "khong" && b === "noi" && (c === "duoc" || c === "ra" || c === "ro"))
      mark(i, 3);
    if (a === "noi" && b === "khong" && (c === "ra" || c === "ro" || c === "duoc"))
      mark(i, 3);
    if (a === "khong" && b === "ho") mark(i, 2);
  }
  return keep;
}

function isContrastBut(token: SafetyToken): boolean {
  if (token.folded !== "nhung") return false;
  if (!token.toned) return true;
  return token.accented === "nhưng";
}

function isContrastMa(token: SafetyToken): boolean {
  if (token.folded !== "ma") return false;
  if (!token.toned) return true;
  return token.accented === "mà";
}

/**
 * Forward scope after a negator. A comma, stop, "nhưng", "mà", or a later
 * "muốn" ends it. "hay" / "hoặc" keep the same negated list going.
 * The immediate "không muốn …" stays inside the scope.
 */
function negationScope(tokens: SafetyToken[]): Set<number> {
  const keep = inabilityKeep(tokens);
  const neg = new Set<number>();
  const add = (index: number) => {
    if (index < 0 || index >= tokens.length || keep.has(index)) return;
    neg.add(index);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const w = token.folded;
    let from = -1;
    if (foldedAt(tokens, i + 1) === "con" && w === "khong") from = i + 2;
    else if (
      foldedAt(tokens, i + 1) === "con" &&
      w === "chang" &&
      (!token.toned || token.accented === "chẳng")
    ) {
      from = i + 2;
    } else if (
      foldedAt(tokens, i + 1) === "con" &&
      w === "cha" &&
      token.toned &&
      token.accented === "chả"
    ) {
      from = i + 2;
    } else if (w === "chua" && foldedAt(tokens, i + 1) === "tung") from = i + 2;
    else if (w === "khong" && foldedAt(tokens, i + 1) === "he") from = i + 2;
    else if (
      w === "khong" &&
      foldedAt(tokens, i + 1) === "bao" &&
      foldedAt(tokens, i + 2) === "gio"
    ) {
      from = i + 3;
    } else if (w === "not" && foldedAt(tokens, i + 1) === "anymore") {
      from = i + 2;
      if (!token.clauseStart) add(i - 1);
      if (i >= 2 && !tokens[i - 1]?.clauseStart) add(i - 2);
    } else if (w === "het") {
      const next = foldedAt(tokens, i + 1);
      // A seizure that restarted, or is still dangerous, stays visible.
      const seizureKept = seizureStillAcute(tokens.map((item) => item.folded).join(" "));
      // "hết co giật" negates the symptom a couple of tokens ahead. "uống hết vỉ" does not.
      for (let k = 1; k <= 3; k++) {
        const ahead = tokens[i + k];
        if (!ahead || ahead.clauseStart) break;
        const word = ahead.folded;
        if (word === "roi") break;
        if (word === "co" || word === "bi" || word === "con" || word === "cai") continue;
        if (seizureKept && (word === "giat" || word === "kinh")) continue;
        if (HET_SYMPTOM.has(word)) add(i + k);
        else break;
      }
      if (next === "roi") {
        if (!token.clauseStart) add(i - 1);
        if (i >= 2 && !tokens[i - 1]?.clauseStart && !token.clauseStart) add(i - 2);
      }
      continue;
    } else if (
      isSimpleNegator(token) &&
      foldedAt(tokens, i + 1) === "chiu" &&
      (foldedAt(tokens, i + 2) === "noi" || foldedAt(tokens, i + 2) === "dung")
    ) {
      // "không chịu nổi" is distress, not a denial of the symptom that follows.
      continue;
    } else if (isSimpleNegator(token)) from = i + 1;
    if (from < 0) continue;
    let limit = 5;
    for (let j = from; j < tokens.length && j < from + limit; j++) {
      const current = tokens[j]!;
      if (current.clauseStart) break;
      const word = current.folded;
      if (isContrastBut(current) || isContrastMa(current)) break;
      if (word === "muon" && j !== from) break;
      add(j);
      if ((word === "hay" || word === "hoac") && limit < 12) limit = 12;
    }
  }
  return neg;
}

function applyNegationMask(tokens: SafetyToken[]): SafetyToken[] {
  const neg = negationScope(tokens);
  if (neg.size === 0) return tokens;
  return tokens.map((token, index) => {
    if (!neg.has(index)) return token;
    return {
      accented: "zz",
      folded: "zz",
      toned: false,
      clauseStart: token.clauseStart,
    };
  });
}

function selfHarmEvidence(tokens: SafetyToken[]): number[] {
  const hits: number[] = [];
  const push = (...indexes: number[]) => {
    for (const index of indexes) {
      if (index >= 0 && index < tokens.length) hits.push(index);
    }
  };
  for (let i = 0; i < tokens.length; i++) {
    const a = foldedAt(tokens, i);
    const b = foldedAt(tokens, i + 1);
    const c = foldedAt(tokens, i + 2);
    if (a === "tu" && b === "tu") push(i, i + 1);
    if (a === "tu" && (b === "sat" || b === "hai" || b === "van")) push(i, i + 1);
    if (a === "quyen" && b === "sinh") push(i, i + 1);
    if (a === "tuyet" && b === "menh") push(i, i + 1);
    if (a === "ket" && b === "lieu") push(i, i + 1);
    if (a === "muon" && b === "bien" && c === "mat") push(i, i + 1, i + 2);
    if (a === "muon" && b === "chet" && !isHyperboleWantDie(tokens, i)) push(i, i + 1);
    if (
      (a === "khong" || a === "chang" || a === "cha") &&
      b === "muon" &&
      c === "song" &&
      foldedAt(tokens, i + 3) !== "chung"
    ) {
      push(i, i + 1, i + 2);
    }
    if (a === "khong" && b === "thiet" && c === "song") push(i, i + 1, i + 2);
    if (a === "nhay" || a === "treo" || a === "rach") push(i);
  }
  return hits;
}

function evidenceIndexes(
  tokens: SafetyToken[],
  riskClass: Exclude<RiskClass, "none">,
): number[] {
  if (riskClass === "self_harm") return selfHarmEvidence(tokens);
  const hits: number[] = [];
  const pushWord = (word: string) => {
    tokens.forEach((token, index) => {
      if (token.folded === word) hits.push(index);
    });
  };
  if (riskClass === "chest_pain") {
    for (const word of ["nguc", "chest", "pain"]) pushWord(word);
  } else if (riskClass === "seizure") pushWord("giat");
  else if (riskClass === "bleeding") pushWord("mau");
  else if (riskClass === "stroke") {
    for (const word of ["quy", "meo", "lech", "ngong", "liet"]) pushWord(word);
    for (let i = 0; i < tokens.length; i++) {
      if (
        foldedAt(tokens, i) === "noi" &&
        foldedAt(tokens, i + 1) === "kho" &&
        foldedAt(tokens, i + 2) !== "nghe"
      ) {
        hits.push(i, i + 1);
      }
      if (foldedAt(tokens, i) !== "yeu") continue;
      const next = foldedAt(tokens, i + 1);
      if (
        next === "nua" ||
        next === "mot" ||
        next === "tay" ||
        next === "chan" ||
        next === "het"
      ) {
        hits.push(i);
      }
    }
  } else if (riskClass === "breathing") {
    for (const word of ["tho", "hen", "ngop"]) pushWord(word);
  } else if (riskClass === "poisoning") {
    for (const word of ["nham", "doc", "chuot", "sau"]) pushWord(word);
    for (let i = 0; i < tokens.length; i++) {
      if (foldedAt(tokens, i) !== "vi") continue;
      const prev = foldedAt(tokens, i - 1);
      if (prev === "het" || prev === "ca" || prev === "thuoc") hits.push(i);
    }
  } else if (riskClass === "unconscious") {
    for (const word of ["ngat", "xiu"]) pushWord(word);
  } else if (riskClass === "head_injury") pushWord("dap");
  else if (riskClass === "fall_emergency") {
    tokens.forEach((token, index) => {
      if (token.folded === "nga") hits.push(index);
      if (token.toned && token.accented === "té") hits.push(index);
    });
  } else if (riskClass === "choking") {
    for (const word of ["nghen", "hoc"]) pushWord(word);
  } else if (riskClass === "low_blood_sugar") {
    for (const word of ["duong", "insulin"]) pushWord(word);
  } else if (riskClass === "severe_allergy") {
    for (const word of ["sung", "phu", "man", "soc"]) pushWord(word);
    for (let i = 0; i < tokens.length - 1; i++) {
      if (foldedAt(tokens, i) === "phan" && foldedAt(tokens, i + 1) === "ve") {
        hits.push(i, i + 1);
      }
    }
  } else if (riskClass === "burn") {
    for (const word of ["bong", "rop"]) pushWord(word);
  }
  return hits;
}

/** True when every word that justifies the class sits inside a negation scope. */
function classFullyNegated(
  tokens: SafetyToken[],
  riskClass: Exclude<RiskClass, "none">,
): boolean {
  const hits = evidenceIndexes(tokens, riskClass);
  if (hits.length === 0) return false;
  const neg = negationScope(tokens);
  return hits.every((index) => neg.has(index));
}

function ingestionSelfHarm(tokens: SafetyToken[], joined: string): boolean {
  if (/\buong nham\b/.test(joined)) return false;
  const method = /\b(uong het|ca vi|thuoc ngu|uong thuoc)\b/.test(joined);
  const intent =
    /\b(de chet|cho chet|tu sat|quyen sinh|khong muon song|ket lieu|tu van|tu hai)\b/.test(
      joined,
    ) || hasRealSuicidePair(tokens);
  return method && intent;
}

/**
 * A plan to swallow poison, including sleeping pills taken in order to die.
 * Accidental "uống nhầm" and a sleeping pill with no death intent stay out.
 * Unaccented "từ từ" is not a death word.
 */
function intentionalSelfPoison(tokens: SafetyToken[], joined: string): boolean {
  if (/\buong nham\b/.test(joined)) return false;
  const method =
    /\b(thuoc doc|thuoc chuot|thuoc diet chuot|thuoc diet co|thuoc diet|thuoc tru sau|hoa chat|dau doc|tu dau doc|chat doc|thuoc sau)\b/.test(
      joined,
    );
  const who = /\b(toi|em|minh|ong|ba|bo|me|anh|chau|con|chu|cu|noi|bao|ke|than)\b/.test(
    joined,
  );
  const plan = /\b(muon|dinh|tinh|toan)\b/.test(joined);
  const firstPersonWill =
    /\b(se|sap)\b/.test(joined) && /\b(toi|em|minh|noi|bao|ke|than)\b/.test(joined);
  const death =
    /\b(de chet|cho chet|chet cho xong|khong day|ngu luon|tu sat|quyen sinh|khong muon song)\b/.test(
      joined,
    ) || hasRealSuicidePair(tokens);
  if (method && who && (plan || firstPersonWill || death)) return true;
  if (/\bthuoc ngu\b/.test(joined) && who && death) return true;
  return false;
}

/** Words that turn "muốn chết" into an intensifier, including a real symptom in the same clause. */
const INTENSIFIER_BEFORE_DIE = new Set([
  "ret",
  "chan",
  "dien",
  "met",
  "doi",
  "khat",
  "vui",
  "buon",
  "so",
  "cuoi",
  "nong",
  "lanh",
  "dau",
  "nhuc",
  "gian",
  "soc",
  "ngai",
  "kho",
  "cang",
  "that",
  "phien",
  "om",
  "bung",
  "lung",
  "rang",
  "hong",
  "khop",
  "vai",
  "nguc",
  "tay",
  "sot",
  "ho",
  "thuong",
  "nan",
  "buc",
  "tuoi",
  "que",
  "nguong",
]);

function speakerBefore(tokens: SafetyToken[], index: number): boolean {
  for (let j = 0; j < index; j++) {
    const word = tokens[j]!.folded;
    if (FIRST_PERSON.has(word) || SPEECH.has(word)) return true;
  }
  return false;
}

function speakerInSameClause(tokens: SafetyToken[], index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    if (!sameClause(tokens, j, index)) break;
    const word = tokens[j]!.folded;
    if (FIRST_PERSON.has(word) || SPEECH.has(word)) return true;
  }
  return false;
}

function intensifierBefore(tokens: SafetyToken[], wantIndex: number): boolean {
  for (let j = wantIndex - 1; j >= 0; j--) {
    if (!sameClause(tokens, j, wantIndex)) break;
    if (INTENSIFIER_BEFORE_DIE.has(tokens[j]!.folded)) return true;
  }
  return false;
}

/**
 * "muốn chết" is an idiom when the same clause only intensifies a feeling or a symptom.
 * A speaker plus a non-idiom predecessor is a plan, including when "muốn" starts the next clause.
 */
function isHyperboleWantDie(tokens: SafetyToken[], wantIndex: number): boolean {
  const prev = tokens[wantIndex - 1];
  if (!prev) return false;
  if (LITERAL_BEFORE_DIE.has(prev.folded)) return false;
  if (intensifierBefore(tokens, wantIndex)) return true;
  if (tokens[wantIndex]!.clauseStart && speakerBefore(tokens, wantIndex)) return false;
  if (speakerInSameClause(tokens, wantIndex)) return false;
  return true;
}

function restContext(tokens: SafetyToken[], index: number): boolean {
  return nearFolded(
    tokens,
    index,
    ["nghi", "ngoi", "tap", "the", "duc", "an", "nhai", "cai", "tang", "cham", "dan"],
    3,
  );
}

function isFirstPersonOrSpeech(token: SafetyToken): boolean {
  return FIRST_PERSON.has(token.folded) || SPEECH.has(token.folded);
}

/** A death wish needs the speaker. A relative mentioned alone is not the plan. */
function personNearDeath(tokens: SafetyToken[], index: number): boolean {
  const from = Math.max(0, index - 8);
  const to = Math.min(tokens.length - 1, index + 4);
  for (let j = from; j <= to; j++) {
    if (isFirstPersonOrSpeech(tokens[j]!)) return true;
  }
  return false;
}

/** "sẽ chết vì bệnh / tuổi" is a prognosis, not a plan to die. */
function prognosisDeath(tokens: SafetyToken[], dieIndex: number): boolean {
  const text = tokens
    .slice(dieIndex + 1, dieIndex + 7)
    .map((token) => token.folded)
    .join(" ");
  if (!/\b(vi|do|boi)\b/.test(text)) return false;
  return /\b(benh|ung|thu|gia|tuoi|tai|nan)\b/.test(text);
}

function nightOrMeans(joined: string): boolean {
  return (
    /\b(toi nay|dem nay|ngay bay gio)\b/.test(joined) ||
    /\b(thuoc doc|thuoc chuot|thuoc ngu|treo co|nhay lau|nhay cau|cat co)\b/.test(joined)
  );
}

/**
 * Intent, a plan, or a farewell. These are classes, not a list of sentences.
 * "muốn chết" next to an intensifier stays an idiom and is handled above.
 */
function cannotLive(tokens: SafetyToken[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const neg =
      token.folded === "khong" ||
      (token.folded === "chang" && (!token.toned || token.accented === "chẳng")) ||
      (token.folded === "cha" && token.toned && token.accented === "chả");
    if (token.folded === "song" && foldedAt(tokens, i + 1) === "khong") {
      const end = foldedAt(tokens, i + 2) === "the" ? i + 3 : i + 2;
      if (foldedAt(tokens, end) === "noi" && foldedAt(tokens, end + 1) !== "tieng") {
        return true;
      }
    }
    if (!neg) continue;
    let j = i + 1;
    if (foldedAt(tokens, j) === "con") j += 1;
    if (foldedAt(tokens, j) === "the") j += 1;
    if (
      foldedAt(tokens, j) === "song" &&
      foldedAt(tokens, j + 1) === "noi" &&
      foldedAt(tokens, j + 2) !== "tieng"
    ) {
      return true;
    }
  }
  return false;
}

/** A plan verb or "sẽ/sắp" directly before "chết", with a person in range. */
function plannedDeath(tokens: SafetyToken[], joined: string): boolean {
  for (let i = 1; i < tokens.length; i++) {
    if (!matchesTarget(tokens[i]!, "chết")) continue;
    if (tokens[i + 1]?.folded === "ngat") continue;
    const prev = tokens[i - 1]!;
    if (prev.folded === "muon") continue;
    const plan =
      prev.folded === "dinh" || prev.folded === "tinh" || prev.folded === "toan";
    const will = prev.folded === "se" || prev.folded === "sap";
    if (!plan && !will) continue;
    if (!personNearDeath(tokens, i)) continue;
    if (plan && intensifierBefore(tokens, i - 1)) continue;
    if (prognosisDeath(tokens, i)) continue;
    if (will && !nightOrMeans(joined)) continue;
    return true;
  }
  return false;
}

/** Goodbye aimed at life. A bare "từ biệt" with no life target stays off. */
function farewellToLife(joined: string): boolean {
  if (/\btrang troi\b/.test(joined)) return true;
  if (!/\b(vinh biet|tam biet|tu biet)\b/.test(joined)) return false;
  return /\b(cuoc doi|cuoc song|mai mai|khong gap lai)\b/.test(joined);
}

/**
 * A plan verb next to ending a life: "kết thúc cuộc đời", "kết liễu", "giết mình".
 * The words are a class, not a copied sentence.
 */
function endingLifePlan(joined: string): boolean {
  if (!/\b(muon|dinh|tinh|toan|se|sap)\b/.test(joined)) return false;
  return (
    /\b(ket lieu|giet minh|giet ban than)\b/.test(joined) ||
    /\bket thuc cuoc (doi|song)\b/.test(joined)
  );
}

function classBasedSelfHarm(tokens: SafetyToken[], joined: string): boolean {
  if (!tokens.some((token) => isFirstPersonOrSpeech(token))) return false;
  return (
    cannotLive(tokens) ||
    plannedDeath(tokens, joined) ||
    farewellToLife(joined) ||
    endingLifePlan(joined)
  );
}

/**
 * A method (pills, poison, jumping, hanging) plus an intent to die.
 * This is self-harm for any person in the sentence, and it outranks poisoning.
 * Accidental "uống nhầm" and a sleeping pill taken in order to sleep stay out.
 */
function intentPlusMethod(tokens: SafetyToken[], joined: string): boolean {
  if (/\buong nham\b/.test(joined)) return false;
  if (
    /\bthuoc ngu\b/.test(joined) &&
    /\b(de ngu|cho de ngu|kho ngu)\b/.test(joined) &&
    !/\b(de chet|cho chet|muon chet|khong day|ngu luon)\b/.test(joined)
  ) {
    return false;
  }
  const method =
    /\b(thuoc doc|thuoc chuot|thuoc diet|thuoc tru sau|hoa chat|thuoc ngu|uong het|ca vi|treo co|nhay lau|nhay cau|nhay ban cong|nhay xuong|cat co tay|rach co tay|tuyet menh)\b/.test(
      joined,
    );
  if (!method) return false;
  return (
    /\b(muon chet|de chet|cho chet|tu sat|quyen sinh|khong muon song|chet cho xong|tu van|tu hai)\b/.test(
      joined,
    ) ||
    hasRealSuicidePair(tokens) ||
    /\b(muon|dinh|tinh|toan)\b/.test(joined)
  );
}

function isHypothetical(joined: string): boolean {
  return /\b(neu|gia su|trong truong hop)\b/.test(joined);
}

function matchSelfHarm(tokens: SafetyToken[]): boolean {
  const joined = tokens.map((token) => token.folded).join(" ");
  if (selfHarmIsPastStable(tokens, joined)) return false;
  if (isSelfHarmInformation(tokens, joined) && !hasTightPersonalPlan(tokens))
    return false;
  if (isHypothetical(joined) && !/\b(dang|vua|toi nay|dem nay)\b/.test(joined)) {
    return false;
  }
  if (isDefinitionQuestion(joined) && !hasTightPersonalPlan(tokens)) return false;
  if (intentPlusMethod(tokens, joined)) return true;
  if (/\bkhong muon song chung\b/.test(joined)) {
    /* living together is not suicidal ideation */
  } else if (hasAnyPhrase(tokens, ["không muốn sống", "không thiết sống", "chán sống"])) {
    return true;
  }
  if (
    !tokens.some((token) => FIRST_PERSON.has(token.folded) || SPEECH.has(token.folded)) &&
    /\b(tin tuc|bao dua|tren bao|mot vu)\b/.test(joined)
  ) {
    return false;
  }
  if (
    tokens.some((token, index) => {
      if (token.folded !== "chang" || (token.toned && token.accented !== "chẳng"))
        return false;
      if (
        foldedAt(tokens, index + 1) !== "muon" ||
        foldedAt(tokens, index + 2) !== "song"
      )
        return false;
      return foldedAt(tokens, index + 3) !== "chung";
    }) ||
    tokens.some((token, index) => {
      if (!(token.toned && token.accented === "chả")) return false;
      if (
        foldedAt(tokens, index + 1) !== "muon" ||
        foldedAt(tokens, index + 2) !== "song"
      )
        return false;
      return foldedAt(tokens, index + 3) !== "chung";
    })
  ) {
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
    /\b(khong day|ngu luon|ket thuc|muon chet|ca vi|het vien|uong het|de chet|cho chet)\b/.test(
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
  if (intentionalSelfPoison(tokens, joined)) return true;

  if (
    hasPhrase(tokens, "quyên sinh") ||
    hasPhrase(tokens, "tự vẫn") ||
    hasPhrase(tokens, "tự hại")
  ) {
    return true;
  }
  if (/\b(ket lieu doi|ket lieu cuoc doi|tu ket lieu)\b/.test(joined)) return true;
  if (/\b(thu tuyet menh|tuyet menh)\b/.test(joined)) return true;
  if (
    /\by dinh\b/.test(joined) &&
    (hasRealSuicidePair(tokens) || /\b(tu sat|quyen sinh|tu van|tu hai)\b/.test(joined))
  ) {
    return true;
  }
  if (
    /\bdang nghi\b/.test(joined) &&
    hasRealSuicidePair(tokens) &&
    !tokens.some((token, index) => token.folded === "tu" && restContext(tokens, index))
  ) {
    return true;
  }
  if (
    /\b(se|sap)\b/.test(joined) &&
    hasRealSuicidePair(tokens) &&
    !tokens.some(
      (token, index) =>
        token.folded === "tu" &&
        foldedAt(tokens, index + 1) === "tu" &&
        restContext(tokens, index),
    )
  ) {
    return true;
  }
  if (ingestionSelfHarm(tokens, joined)) return true;

  // "chán đời" alone is an idiom. A self-harm hint beside it still counts.
  if (
    hasPhrase(tokens, "chán đời") &&
    /\b(muon chet|tu tu|khong muon song|bien mat|ket thuc|thuoc ngu|treo co)\b/.test(
      joined,
    )
  ) {
    return true;
  }

  return classBasedSelfHarm(tokens, joined);
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

const SEIZURE_FOREIGN = new Set([
  "dau",
  "nguc",
  "sot",
  "ho",
  "non",
  "oi",
  "mau",
  "bung",
  "tim",
  "lung",
  "vai",
  "hong",
]);

function seizureSpanLength(tokens: SafetyToken[], index: number): number {
  const a = foldedAt(tokens, index);
  const b = foldedAt(tokens, index + 1);
  if (a === "co" && b === "giat") return 2;
  if (a === "dong" && b === "kinh") return 2;
  if (a === "giat") return 1;
  return 0;
}

function isSeizureDone(tokens: SafetyToken[], index: number): boolean {
  const word = foldedAt(tokens, index);
  if (word === "het" || word === "xong") return true;
  if (word === "qua" && foldedAt(tokens, index - 1) === "da") return true;
  if (word === "dung" && foldedAt(tokens, index - 1) === "da") {
    const token = tokens[index]!;
    return !token.toned || token.accented === "dừng";
  }
  if (word === "roi") {
    const prev = foldedAt(tokens, index - 1);
    return prev === "het" || prev === "giat" || prev === "kinh" || prev === "xong";
  }
  return false;
}

function isForeignSymptom(word: string): boolean {
  // "zz" is a symptom negation already masked, such as the "đau" in "hết đau".
  return word === "zz" || SEIZURE_FOREIGN.has(word);
}

/** "hết đau" ends the pain. It does not end a seizure named later. */
function doneBindsForeign(tokens: SafetyToken[], index: number): boolean {
  if (isForeignSymptom(foldedAt(tokens, index + 1))) return true;
  let prev = index - 1;
  if (foldedAt(tokens, prev) === "da") prev -= 1;
  return isForeignSymptom(foldedAt(tokens, prev));
}

function foreignBetween(tokens: SafetyToken[], from: number, to: number): boolean {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (let k = start + 1; k < end; k++) {
    if (isForeignSymptom(tokens[k]!.folded)) return true;
  }
  return false;
}

/**
 * A stopped seizure in either order: "hết co giật" and "co giật đã hết".
 * An ongoing cue still blocks this. A different symptom sitting on "hết" does not.
 */
/** A stopped seizure that restarted, is still dangerous, or never really ended. */
function seizureStillAcute(folded: string): boolean {
  if (
    /\b(lai co giat|lai giat|giat lai|co giat lai|bat dau lai|len con lai|started again)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(chua tinh|khong tinh|chua day|khong day|khong dap ung|khong phan ung|khong con phan ung|khong con dap ung|van chua tinh|chua tinh lai|khong tinh nguoi|me man|khong goi duoc|goi khong duoc|van bat tinh|khong nhuc nhao|bat tinh|chua mo mat|khong tra loi|khong mo mat|hon me|li bi|khong phan hoi|nam bat dong|van me|khong con biet gi)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(hon 5 phut|qua 5 phut|tren 5 phut|lau hon 5|keo dai hon 5|hon nam phut|hon 5p|hon 10 phut|hon muoi phut|qua 10 phut|tren 10 phut|lau hon 10|keo dai hon 10|dai hon muoi|hon 10p)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (/\b(mang thai|co thai|dang mang bau)\b/.test(folded)) return true;
  const oldBleed =
    /\b(hom qua|hom truoc|truoc do|luc truoc|da cam|lau roi|nam ngoai|da lanh|vet cu|khong con chay|tu lau|da kho|vet seo|may hom truoc)\b/.test(
      folded,
    );
  if (
    !oldBleed &&
    /\b(chan thuong|dap dau|chay mau|thuong tich|bi thuong)\b/.test(folded)
  ) {
    return true;
  }
  if (/\b(kho tho|khong tho|tho yeu|tho nong|ngung tho|tho khong ra)\b/.test(folded))
    return true;
  return false;
}

/**
 * A first seizure that has already finished.
 * This is decided before the still-acute check, so "lên cơn" plus "đã hết"
 * gets the calm hospital line. Someone still not awake, not breathing,
 * seizing again, pregnant, or past five minutes stays on the acute screen.
 */
function firstEpisodeAlreadyOver(folded: string): boolean {
  if (!/\b(lan dau|lan dau tien)\b/.test(folded)) return false;
  if (!/\b(co giat|dong kinh|len con)\b/.test(folded)) return false;
  if (
    !/\b(da het|het roi|xong roi|da qua|da xong|da dung|gio het|bay gio het)\b/.test(
      folded,
    )
  )
    return false;
  if (
    /\b(chua tinh|khong tinh|chua day|khong day|khong tho|ngung tho|hon 5 phut|qua 5 phut|tren 5 phut|mang thai|co thai|dang mang bau|giat lai|len con lai|bat dau lai|lai co giat)\b/.test(
      folded,
    )
  ) {
    return false;
  }
  return true;
}

function seizureHasResolved(tokens: SafetyToken[], folded: string): boolean {
  if (firstEpisodeAlreadyOver(folded)) return true;
  if (seizureStillAcute(folded)) return false;
  if (
    /\b(dang giat|dang co giat|giat khong ngung|giat khong dung|giat lien|sui bot|co cung|cung nguoi|len con)\b/.test(
      folded,
    )
  ) {
    return false;
  }
  if (
    /\b(co giat|dong kinh)\s+(xong|roi|het)\b/.test(folded) ||
    /\b(xong|het|da het)\s+(?:roi\s+)?(?:con\s+)?(?:co\s+)?(?:giat|dong kinh)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  const spans: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const len = seizureSpanLength(tokens, i);
    if (len > 0) spans.push({ start: i, end: i + len - 1 });
  }
  if (spans.length === 0) return false;
  for (let i = 0; i < tokens.length; i++) {
    if (!isSeizureDone(tokens, i) || doneBindsForeign(tokens, i)) continue;
    for (const span of spans) {
      const dist = i < span.start ? span.start - i : i > span.end ? i - span.end : 0;
      if (dist === 0 || dist > 8) continue;
      const edge = i < span.start ? span.start : span.end;
      if (foreignBetween(tokens, i, edge)) continue;
      return true;
    }
  }
  return false;
}

function seizureMentionIsInformational(folded: string): boolean {
  if (
    /\b(dang giat|dang co giat|giat khong|giat lien|sui bot|co cung|cung nguoi|len con|bat tinh|giat khong dung)\b/.test(
      folded,
    )
  ) {
    return false;
  }
  // A live seizure keeps its screen when the only extra is a ", là gì?" tail.
  const core = folded.replace(
    /\b(la gi|phai lam sao|lam sao bay gio|phai lam gi)\b/g,
    " ",
  );
  return /\b(dau hieu|trieu chung|thong tin|tim hieu|hay gap|thuong gap|nguyen nhan|cach nhan|nhan biet)\b/.test(
    core,
  );
}

function matchSeizure(tokens: SafetyToken[], folded: string): boolean {
  if (seizureHasResolved(tokens, folded)) return false;
  if (seizureMentionIsInformational(folded)) return false;
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

function matchBurn(folded: string): boolean {
  if (
    /\b(bong nhe|bong nho|bong chut|bong mot chut|bong hoi|hoi bong|chi bong|bong rat nhe)\b/.test(
      folded,
    ) &&
    !/\b(khap|rong|nang|sau|dien|hoa chat|nuoc soi|lua|phong rop)\b/.test(folded)
  ) {
    return false;
  }
  if (
    /\b(phong bong|cach phong bong|lam sao phong|de phong bong|ngan ngua bong|cach so cuu)\b/.test(
      folded,
    ) &&
    !/\b(dang bong|vua bong|phong rop|bong nang|bong khap)\b/.test(folded)
  ) {
    return false;
  }
  if (
    /\b(bong nang|bong sau|bong khap|bong rong|bong dien|bong hoa chat|bong nuoc soi|bong lua)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(nuoc soi|dinh lua|giat dien|dien giat)\b/.test(folded) &&
    /\b(bong|phong rop|rop)\b/.test(folded)
  ) {
    return true;
  }
  if (
    /\bphong rop\b/.test(folded) &&
    /\b(khap|rong|nhieu|chan|tay|lung|bung|dui|nguoi)\b/.test(folded)
  ) {
    return true;
  }
  if (
    /\b(hoa chat|axit)\b/.test(folded) &&
    /\bbong\b/.test(folded) &&
    !/\buong\b/.test(folded)
  ) {
    return true;
  }
  return false;
}

function hasIngestionWord(folded: string): boolean {
  return /\b(uong|nuot|an|ngo)\b/.test(folded);
}

function matchPoison(folded: string): boolean {
  const named =
    /\b(uong nham|qua lieu|ngo doc|thuoc tru sau|thuoc diet co|thuoc diet chuot|thuoc chuot|ca vi thuoc|uong ca vi|uong het vi|het vi thuoc|uong het thuoc)\b/.test(
      folded,
    );
  if (!named) return false;
  return hasIngestionWord(folded);
}

/** A swallowed dose the verifier should see: on purpose, or a large amount. */
export function ingestionIsDeliberateOrLarge(question: string): boolean {
  const { folded } = analyzeQuestion(question);
  if (!hasIngestionWord(folded) && !matchPoison(folded)) return false;
  if (
    /\b(ca vi|het vi|uong het|nuot het|qua lieu|nhieu vien|ca hop|hang chuc vien|mot vi)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return /\b(co y|co tinh|chu dich|tu uong|dinh uong)\b/.test(folded);
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
  return /\b(chay mau nhieu|chay mau khong cam|chay mau khong ngung|chay mau o at|chay mau khong dung|mau khong ngung|mau khong cam|mau khong dung|cam mau khong|cam mau khong duoc|non ra mau|non mau|oi ra mau|di ngoai ra mau|di cau ra mau|ia ra mau|ho ra mau|dai tien ra mau|xuat huyet nang|mau chay nhieu|mau chay khong|mau tuoi|mau thanh dong|chay thanh dong|mau phun|mau vot|mau xoi|mau loang|mau dam|tham dam|lenh lang|mau chay ao|ra mau nhieu|mat nhieu mau)\b/.test(
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
  // "phồng" folds like "phòng". Blisters are not a prevention question.
  const text = folded.replace(/\bphong rop\b/g, "blister");
  return /\b(co sao khong|co nguy hiem khong|co hai khong|co phai|cham soc|co nen|phong|nen tap|nen an|dinh ky|on dinh|dau hieu|cach so cuu|khi gang suc|vat ly tri lieu|uong thuoc deu|ngay xua|nam truoc|co de bi|co tot khong|de khong|tranh bi|tranh hoc)\b/.test(
    text,
  );
}

/**
 * Question frames cancel a topic only when no acute picture is present.
 * A live sign, a sudden change, or a named person with that sign always wins.
 */
/** A definition or "what are the signs" question, not a live event with a person. */
function isDefinitionQuestion(folded: string): boolean {
  if (isSudden(folded)) return false;
  if (hasSpecificPerson(folded) && hasHardClinical(folded)) return false;
  return (
    /\b(dau hieu|nguyen nhan|dinh nghia|la benh gi|benh gi|co phai dau hieu|cach nhan|nhan biet)\b/.test(
      folded,
    ) ||
    (/\bla gi\b/.test(folded) && !hasSpecificPerson(folded))
  );
}

function isEducation(folded: string): boolean {
  const sudden = isSudden(folded);
  const past = isPastOrStable(folded);
  const hard = hasHardClinical(folded);
  if (past && !sudden) return true;
  if (isDefinitionQuestion(folded)) return true;
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

/** After a seizure has stopped: hospital check and 115, without the full panic screen. */
export const POST_SEIZURE_CHECK_LINE =
  "Cơn co giật đã qua. Hãy đưa người bệnh đi bệnh viện để được kiểm tra, và gọi 115 nếu cơn trở lại hoặc người bệnh chưa tỉnh.";

export function seizureLooksResolved(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  return seizureHasResolved(tokens, folded);
}

/** One line, not the crisis screen. Used only when the classifier is unsure. */
export const GENTLE_SUPPORT_LINE =
  "Nếu bạn đang thấy quá sức, hãy ở cạnh người thân và liên hệ tổng đài 115.";

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

function seizureSignal(tokens: SafetyToken[], folded: string): boolean {
  if (matchSeizure(tokens, folded)) return true;
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

function matchesClass(
  riskClass: Exclude<RiskClass, "none">,
  tokens: SafetyToken[],
  folded: string,
): boolean {
  switch (riskClass) {
    case "self_harm":
      return matchSelfHarm(tokens);
    case "severe_allergy":
      return matchAllergy(folded);
    case "low_blood_sugar":
      return matchGlucose(folded);
    case "seizure":
      return matchSeizure(tokens, folded);
    case "breathing":
      return matchBreathing(folded);
    case "choking":
      return matchChoking(tokens, folded);
    case "chest_pain":
      return matchChest(folded);
    case "poisoning":
      return matchPoison(folded);
    case "bleeding":
      return matchBleeding(folded);
    case "head_injury":
      return matchHead(folded);
    case "unconscious":
      return matchUnconscious(tokens, folded);
    case "stroke":
      return matchStroke(folded);
    case "fall_emergency":
      return matchFall(tokens, folded);
    case "burn":
      return matchBurn(folded);
    default:
      return false;
  }
}

/** Unaccented "từ từ" with no real suicide pair. The model must not open a crisis. */
function gradualTuTuOnly(tokens: SafetyToken[]): boolean {
  let saw = false;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i]!.folded !== "tu" || tokens[i + 1]!.folded !== "tu") continue;
    saw = true;
    const kind = suicidePairKind(tokens, i);
    if (kind === "real" || kind === "adjacent") return false;
  }
  return saw;
}

/**
 * A lexicon cue of a more specific class replaces a lower model label.
 * A chest-pain picture with sweating or pain spreading to the arm stays chest pain
 * when the model also says chest pain.
 * Education and stable history do not become a full screen from the classifier.
 */
export function refineClassifierRisk(
  question: string,
  modelClass: Exclude<RiskClass, "none">,
): Exclude<RiskClass, "none"> | null {
  const { tokens, folded } = analyzeQuestion(question);
  const masked = applyNegationMask(tokens);
  const maskedFolded = masked.map((token) => token.folded).join(" ");
  const past = selfHarmIsPastStable(tokens, folded);
  const ruled = evaluateHighRisk(question);
  if (ruled.matched && ruled.riskClass !== "none") return ruled.riskClass;
  if (classFullyNegated(tokens, modelClass)) return null;
  if (
    (modelClass === "chest_pain" ||
      modelClass === "seizure" ||
      modelClass === "unconscious") &&
    hasExplicitFigurativeMarker(question)
  ) {
    return null;
  }
  const cardiac =
    matchChest(maskedFolded) || /\b(tim|nguc|mo hoi|toat mo hoi)\b/.test(maskedFolded);
  if (modelClass === "chest_pain" && !cardiac) {
    if (breathingSignal(folded) && !chestPainPicture(folded)) return "breathing";
    if (matchStroke(folded)) return "stroke";
    if (matchSeizure(tokens, folded)) return "seizure";
    if (matchBleeding(folded)) return "bleeding";
    return null;
  }
  if (modelClass === "chest_pain" && past && !matchChest(folded)) return null;
  if (
    modelClass === "poisoning" &&
    matchBleeding(folded) &&
    !matchPoison(folded) &&
    !matchSelfHarm(masked)
  ) {
    return "bleeding";
  }
  if (
    modelClass === "unconscious" &&
    matchStroke(folded) &&
    !matchUnconscious(tokens, folded)
  ) {
    return "stroke";
  }
  if (
    past &&
    !isSudden(folded) &&
    (modelClass === "self_harm" || modelClass === "poisoning")
  ) {
    if (
      modelClass === "self_harm" ||
      !/\b(uong nham|qua lieu|ngo doc|thuoc chuot|thuoc diet|thuoc tru sau)\b/.test(
        folded,
      )
    ) {
      return null;
    }
  }
  if (matchSelfHarm(masked)) return "self_harm";
  if (modelClass === "seizure" && seizureHasResolved(tokens, folded)) return null;
  if (
    matchesClass(modelClass, tokens, folded) &&
    !matchesClass(modelClass, masked, maskedFolded)
  ) {
    return null;
  }
  if (
    modelClass === "poisoning" &&
    /\bthuoc ngu\b/.test(folded) &&
    /\b(de ngu|cho de ngu|kho ngu)\b/.test(folded) &&
    !matchPoison(folded) &&
    !matchSelfHarm(masked)
  ) {
    return null;
  }
  if (modelClass === "self_harm") {
    if (isSelfHarmInformation(tokens, folded) && !hasTightPersonalPlan(tokens))
      return null;
    if (onlyHyperboleSelfHarm(tokens)) return null;
    if (classFullyNegated(tokens, "self_harm")) return null;
    if (gradualTuTuOnly(tokens)) return null;
    if (
      /\bthuoc ngu\b/.test(folded) &&
      /\b(de ngu|cho de ngu|kho ngu)\b/.test(folded) &&
      !matchSelfHarm(masked)
    ) {
      return null;
    }
    return "self_harm";
  }
  if (classFullyNegated(tokens, modelClass)) return null;
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
    seizureSignal(tokens, folded) &&
    (modelClass === "poisoning" || modelClass === "unconscious")
  ) {
    return "seizure";
  }
  if (breathingSignal(folded) && !chestPainPicture(folded) && lower) return "breathing";
  if (modelClass === "poisoning" && !hasIngestionWord(folded) && !matchPoison(folded)) {
    return null;
  }
  return modelClass;
}

const ACCOMPANYING_ACUTE = new Set<Exclude<RiskClass, "none">>([
  "chest_pain",
  "poisoning",
  "seizure",
  "unconscious",
  "bleeding",
]);

function pickAcuteClass(
  tokens: SafetyToken[],
  folded: string,
): Exclude<RiskClass, "none" | "self_harm"> | null {
  const take = (ok: boolean, riskClass: Exclude<RiskClass, "none">) =>
    ok && !classFullyNegated(tokens, riskClass);

  const poison = matchPoison(folded);
  const unconscious = matchUnconscious(tokens, folded);
  const chest = matchChest(folded);
  const choking = matchChoking(tokens, folded);
  const breathing = matchBreathing(folded);
  if (
    take(
      matchAllergy(folded) || (allergySignal(folded) && (poison || unconscious || chest)),
      "severe_allergy",
    )
  ) {
    return "severe_allergy";
  }
  if (
    take(
      matchGlucose(folded) ||
        (sugarContext(folded) &&
          /\b(ngat|xiu|bat tinh|khong tinh|lo mo|hon me)\b/.test(folded) &&
          (poison || unconscious || matchGlucose(folded))),
      "low_blood_sugar",
    )
  ) {
    return "low_blood_sugar";
  }
  if (
    take(
      matchSeizure(tokens, folded) ||
        (seizureSignal(tokens, folded) && (poison || unconscious)),
      "seizure",
    )
  ) {
    return "seizure";
  }
  const chestWords = chest || /\b(nguc|dau tim|that nguc|tuc nguc)\b/.test(folded);
  // A named symptom outranks choking and unconscious. Chest outranks breathing
  // when a chest word is present, even without sweating or pain down the arm.
  if (take(Boolean(chest && chestWords), "chest_pain")) return "chest_pain";
  if (take(breathing && !chestWords, "breathing")) return "breathing";
  if (take(matchStroke(folded), "stroke")) return "stroke";
  if (take(matchBleeding(folded), "bleeding")) return "bleeding";
  if (take(matchBurn(folded), "burn")) return "burn";
  if (take(matchHead(folded), "head_injury")) return "head_injury";
  if (take(matchFall(tokens, folded), "fall_emergency")) return "fall_emergency";
  if (take(poison, "poisoning")) return "poisoning";
  if (take(choking, "choking")) return "choking";
  if (take(unconscious, "unconscious")) return "unconscious";
  if (take(breathing, "breathing")) return "breathing";
  if (take(chest, "chest_pain")) return "chest_pain";
  if (
    take(breathingSignal(folded) && !chestWords && (poison || unconscious), "breathing")
  ) {
    return "breathing";
  }
  return null;
}

function pickRiskClass(
  tokens: SafetyToken[],
  folded: string,
): Exclude<RiskClass, "none"> | null {
  if (matchSelfHarm(tokens) && !classFullyNegated(tokens, "self_harm"))
    return "self_harm";
  return pickAcuteClass(tokens, folded);
}

/**
 * Broad wording that must not open the crisis screen by itself.
 * "không chịu nổi" and hay/hoặc plus "chết" stay cues for the classifier.
 */
function ambiguousSelfHarmCue(tokens: SafetyToken[]): boolean {
  const joined = tokens.map((token) => token.folded).join(" ");
  if (
    hasAnyPhrase(tokens, ["không chịu nổi"]) &&
    tokens.some((token) => FIRST_PERSON.has(token.folded))
  ) {
    return true;
  }
  return (
    /\b(hay|hoac|or)\b/.test(joined) &&
    /\b(chet|tu tu|tu sat)\b/.test(joined) &&
    tokens.some((token) => FIRST_PERSON.has(token.folded) || SPEECH.has(token.folded))
  );
}

function isDistressNegator(tokens: SafetyToken[], index: number): boolean {
  const next = foldedAt(tokens, index + 1);
  const third = foldedAt(tokens, index + 2);
  if (next === "con") return true;
  if (next === "muon" && third === "song") return true;
  if (next === "thiet") return true;
  if (next === "chiu" && (third === "noi" || third === "dung")) return true;
  if (next === "song" && third === "noi") return true;
  return false;
}

/**
 * A negator hides a self-harm cue only when it directly denies that cue's verb:
 * first person, same clause, at most two tokens away. Distress phrases,
 * "không còn", "chưa", and hay/hoặc ambivalence stay visible.
 */
function applySelfHarmDenial(tokens: SafetyToken[]): SafetyToken[] {
  const hide = new Set<number>();
  for (const cue of selfHarmEvidence(tokens)) {
    for (let back = 1; back <= 2; back++) {
      const at = cue - back;
      const token = tokens[at];
      if (!token) break;
      if (back > 1 && tokens[at + 1]?.clauseStart) break;
      if (!isSimpleNegator(token) || token.folded === "chua") continue;
      if (isDistressNegator(tokens, at)) continue;
      let blocked = false;
      for (let k = at + 1; k <= cue; k++) {
        if (k !== cue && tokens[k]?.clauseStart) blocked = true;
        const word = tokens[k]?.folded;
        if (word === "hay" || word === "hoac" || word === "or") blocked = true;
      }
      if (blocked) continue;
      let person = false;
      for (let j = at; j >= 0; j--) {
        if (j !== at && tokens[j + 1]?.clauseStart) break;
        if (FIRST_PERSON.has(tokens[j]!.folded)) person = true;
      }
      if (!person) continue;
      hide.add(cue);
    }
  }
  if (hide.size === 0) return tokens;
  return tokens.map((token, index) => {
    if (!hide.has(index)) return token;
    return { accented: "zz", folded: "zz", toned: false, clauseStart: token.clauseStart };
  });
}

export function evaluateHighRisk(question: string): SafetyMatch {
  const { tokens, folded } = analyzeQuestion(question);
  const forHarm = applySelfHarmDenial(tokens);
  const masked = applyNegationMask(tokens);
  const maskedFolded = masked.map((token) => token.folded).join(" ");
  const crisisAllowed = matchSelfHarm(forHarm) && cleanInstantCrisis(question);
  let riskClass = crisisAllowed ? "self_harm" : pickRiskClass(masked, maskedFolded);
  if (riskClass === "self_harm" && !cleanInstantCrisis(question)) {
    riskClass = pickAcuteClass(masked, maskedFolded);
  }

  if (riskClass && riskClass !== "self_harm" && isEducation(folded)) riskClass = null;
  if (
    riskClass &&
    riskClass !== "self_harm" &&
    isHypothetical(folded) &&
    !isSudden(folded)
  ) {
    riskClass = null;
  }
  if (
    riskClass === "poisoning" &&
    selfHarmIsPastStable(tokens, folded) &&
    !isSudden(folded) &&
    !/\b(uong nham|qua lieu|ngo doc|thuoc chuot|thuoc diet|thuoc tru sau)\b/.test(folded)
  ) {
    riskClass = null;
  }
  // "hết" can hide the seizure word, and "chưa tỉnh" can be masked as a negator.
  // A restart, a long seizure, or someone still not awake stays on the acute screen.
  if (
    !riskClass &&
    !seizureHasResolved(tokens, folded) &&
    !classFullyNegated(tokens, "seizure") &&
    seizureStillAcute(folded) &&
    /\b(co giat|dong kinh)\b/.test(folded)
  ) {
    riskClass = "seizure";
  }

  if (!riskClass) {
    return {
      matched: false,
      riskClass: "none",
      message: "",
      rulesetVersion: SAFETY_RULESET_VERSION,
    };
  }

  const presented = presentAcuteScreen(riskClass, question);
  return {
    matched: true,
    riskClass: presented.riskClass,
    message: presented.message,
    rulesetVersion: SAFETY_RULESET_VERSION,
  };
}

function accompanyingAcute(
  question: string,
): Exclude<RiskClass, "none" | "self_harm"> | null {
  const { tokens, folded } = analyzeQuestion(question);
  const masked = applyNegationMask(tokens);
  const maskedFolded = masked.map((token) => token.folded).join(" ");
  let acute = pickAcuteClass(masked, maskedFolded);
  if (acute && isEducation(folded)) acute = null;
  if (acute && isHypothetical(folded) && !isSudden(folded)) acute = null;
  if (!acute || !ACCOMPANYING_ACUTE.has(acute)) return null;
  return acute;
}

function stepsAfterHeader(message: string): string {
  if (!message.startsWith(CALL)) return message;
  return message.slice(CALL.length).replace(/^\n+/, "");
}

/** Crisis steps for a late upgrade. The first screen already has its own header. */
export function crisisUpgradeText(): string {
  return stepsAfterHeader(MESSAGES.self_harm);
}

/** Crisis block first, then one acute screen, with the emergency header once. */
export function composeCrisisFirst(
  acute: Exclude<RiskClass, "none" | "self_harm">,
): string {
  return `${MESSAGES.self_harm}\n\n${stepsAfterHeader(MESSAGES[acute])}`;
}

function ingestedHarm(folded: string): boolean {
  return (
    matchPoison(folded) ||
    /\b(uong het|ca vi|nuot thuoc|uong thuoc|dau doc|tu dau doc|thuoc doc|thuoc ngu|chat doc)\b/.test(
      folded,
    )
  );
}

/**
 * A wish or plan about one's own life that is not yet a high-precision screen.
 * The class is the cue. The classifier and the verifier choose the screen.
 * Passive and euphemistic forms stay here. They are not added to the instant list.
 */
function indirectFirstPersonIntent(tokens: SafetyToken[], joined: string): boolean {
  if (!tokens.some((token) => FIRST_PERSON.has(token.folded))) return false;
  if (
    /\b(roi bo cuoc doi|roi bo cuoc song|trut bo cuoc doi|trut bo cuoc song|buong bo cuoc song|khong muon ton tai)\b/.test(
      joined,
    )
  ) {
    return true;
  }
  // Passive or euphemistic first person: ending a life, or not waking up.
  // These stay cues. They are not added to the instant list.
  if (
    /\b(khong bao gio thuc|khong bao gio tinh|mot giac khong|giac ngu khong day|ngu khong day|khong con tinh lai|uoc duoc chet|muon duoc chet|mong duoc chet|duoc giai thoat khoi cuoc|roi khoi cuoc doi|bien mat khoi cuoc doi|cuoc doi minh dung|doi minh dung lai|duoc cho ket thuc|de mac chet|cho cuoc doi ket thuc)\b/.test(
      joined,
    )
  ) {
    return true;
  }
  if (!/\b(muon|dinh|tinh|toan|se|sap|dang|chi)\b/.test(joined)) return false;
  return /\b(cuoc doi|cuoc song|doi minh|ban than|ket lieu|giet minh|giet ban than|bien mat|buong xuoi|giai thoat|cham dut|khong muon ton tai|khong muon tiep|ngu mai|ngu luon|bo cuoc|ket thuc tat ca|ket thuc moi thu|ra di mai|ra di luon|khong tinh lai|khong tro ve|trut bo|roi bo)\b/.test(
    joined,
  );
}

/** A denial or a minimizer sitting with an intent topic. The 2-token window does not clear it. */
function denialBesideIntent(tokens: SafetyToken[], joined: string): boolean {
  if (!hasSelfHarmTopic(tokens, joined) && !indirectFirstPersonIntent(tokens, joined)) {
    return false;
  }
  if (tokens.some((token) => isSimpleNegator(token) && token.folded !== "chua"))
    return true;
  return /\b(khong sao|noi choi|noi dua|chi dua|chi noi|khong nghiem|khong phai that|thoi ma)\b/.test(
    joined,
  );
}

const MINIMIZER_RE =
  /\b(khong sao|noi choi|noi dua|chi dua|chi noi|khong nghiem|khong phai that|thoi ma)\b/;

function splitSentences(question: string): string[] {
  const parts = question
    .normalize("NFC")
    .split(/[.!?…\n]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [question];
}

function isNegatedSubject(tokens: SafetyToken[], index: number): boolean {
  const token = tokens[index];
  if (!token) return false;
  const next = foldedAt(tokens, index + 1);
  if (
    (token.folded === "khong" ||
      token.folded === "chang" ||
      token.folded === "cha" ||
      token.folded === "no") &&
    next === "ai"
  ) {
    return true;
  }
  if (token.folded === "nobody") return true;
  if (token.folded === "no" && (next === "one" || next === "body")) return true;
  return false;
}

/** Fixed distress. These do not deny the intent verb. */
function isFixedDistress(tokens: SafetyToken[], index: number): boolean {
  const a = foldedAt(tokens, index);
  const b = foldedAt(tokens, index + 1);
  const c = foldedAt(tokens, index + 2);
  if (a === "khong" && b === "loi" && c === "thoat") return true;
  if (a === "no" && b === "way" && foldedAt(tokens, index + 2) === "out") return true;
  if (
    (a === "khong" || a === "chang" || a === "cha") &&
    b === "chiu" &&
    (c === "noi" || c === "dung")
  ) {
    return true;
  }
  if (a === "khong" && b === "the" && c === "chiu") return true;
  if ((a === "cant" || a === "cannot") && b === "bear") return true;
  if (a === "can" && b === "not" && c === "bear") return true;
  return false;
}

const INTENT_LEAD = new Set([
  "muon",
  "dinh",
  "tinh",
  "nghi",
  "tu",
  "quyen",
  "tuyet",
  "ket",
]);
const NEGATION_SKIP = new Set([
  "he",
  "con",
  "bao",
  "gio",
  "tung",
  "the",
  "co",
  "y",
  "dinh",
  "nao",
  "lam",
  "den",
  "viec",
  "mot",
  "cai",
]);

/** The negator sits on the intent verb, not on another phrase in the sentence. */
function governsIntentVerb(tokens: SafetyToken[], index: number): boolean {
  const cues = selfHarmEvidence(tokens);
  if (cues.length === 0) return false;
  let start = index + 1;
  const word = tokens[index]?.folded;
  if (word === "chua" && foldedAt(tokens, index + 1) === "tung") start = index + 2;
  else if (
    word === "chua" &&
    foldedAt(tokens, index + 1) === "bao" &&
    foldedAt(tokens, index + 2) === "gio"
  ) {
    start = index + 3;
  } else if (word === "khong" && foldedAt(tokens, index + 1) === "he") start = index + 2;
  else if (word === "khong" && foldedAt(tokens, index + 1) === "con") start = index + 2;
  else if (
    word === "khong" &&
    foldedAt(tokens, index + 1) === "bao" &&
    foldedAt(tokens, index + 2) === "gio"
  ) {
    start = index + 3;
  }
  let cursor = start;
  while (
    cursor < tokens.length &&
    !tokens[cursor]?.clauseStart &&
    NEGATION_SKIP.has(foldedAt(tokens, cursor))
  ) {
    cursor += 1;
  }
  if (cursor >= tokens.length) return false;
  if (tokens[cursor]?.clauseStart && cursor !== start) return false;
  const lead = foldedAt(tokens, cursor);
  if (!cues.includes(cursor) && !INTENT_LEAD.has(lead)) return false;
  return cues.some(
    (cue) => cue >= cursor && cue - cursor <= 3 && sharesClause(tokens, index, cue),
  );
}

/**
 * A negator counts only when it governs the intent verb.
 * A negated subject and fixed distress phrases do not.
 * Bare "chưa" does not. "chưa bao giờ" and "chưa từng" do.
 */
function isDemotionNegator(tokens: SafetyToken[], index: number): boolean {
  const token = tokens[index];
  if (!token) return false;
  if (isNegatedSubject(tokens, index) || isFixedDistress(tokens, index)) return false;
  if (token.folded === "chua") {
    const next = foldedAt(tokens, index + 1);
    const third = foldedAt(tokens, index + 2);
    if (!(next === "tung" || (next === "bao" && third === "gio"))) return false;
    return governsIntentVerb(tokens, index);
  }
  if (!isSimpleNegator(token)) return false;
  const next = foldedAt(tokens, index + 1);
  const third = foldedAt(tokens, index + 2);
  const fourth = foldedAt(tokens, index + 3);
  if (next === "muon" && third === "song" && fourth !== "chung") return false;
  if (next === "thiet") return false;
  if (next === "song" && third === "noi") return false;
  if (next === "chiu" && (third === "noi" || third === "dung")) return false;
  // "không còn muốn" denies a plan. "không còn sức" and "chẳng còn ý nghĩa" do not.
  if (next === "con") {
    const denies =
      third === "muon" ||
      third === "nghi" ||
      third === "dinh" ||
      third === "tinh" ||
      third === "tu";
    if (!denies) return false;
  }
  // "không dậy" / "không thở" is the outcome, not a denial of the plan.
  if (
    next === "day" ||
    next === "tho" ||
    next === "ngoi" ||
    next === "dung" ||
    next === "di" ||
    next === "an" ||
    next === "ngu" ||
    (next === "tinh" && third !== "tu")
  ) {
    return false;
  }
  return governsIntentVerb(tokens, index);
}

function sharesClause(tokens: SafetyToken[], a: number, b: number): boolean {
  return sameClause(tokens, Math.min(a, b), Math.max(a, b));
}

/** A denial negator in the same clause as the intent cue. A later clause does not reach back. */
function denialInIntentClause(tokens: SafetyToken[]): boolean {
  const cues = selfHarmEvidence(tokens);
  if (cues.length === 0) return false;
  return tokens.some((_, index) => {
    if (!isDemotionNegator(tokens, index)) return false;
    return cues.some((cue) => sharesClause(tokens, index, cue));
  });
}

/**
 * Minimizers and hypotheticals cover the sentence. A negator covers only the
 * intent clause, so a comma plus ", là gì?" does not cancel a real plan.
 * Reported speech stays on the screen: the public fixture includes it.
 */
function sentenceHasDemotionMarker(tokens: SafetyToken[], joined: string): boolean {
  if (isHypothetical(joined)) return true;
  if (MINIMIZER_RE.test(joined)) return true;
  if (isSelfHarmInformation(tokens, joined) && !hasTightPersonalPlan(tokens)) return true;
  return denialInIntentClause(tokens);
}

function sentenceAllowsInstantCrisis(sentence: string): boolean {
  const { tokens, folded } = analyzeQuestion(sentence);
  if (!matchSelfHarm(tokens)) return false;
  if (sentenceHasDemotionMarker(tokens, folded)) return false;
  return true;
}

/**
 * The instant crisis screen is one clean first-person intent sentence.
 * A marker anywhere in that sentence blocks it. The 2-token window is not widened.
 */
export function cleanInstantCrisis(question: string): boolean {
  return splitSentences(question).some((sentence) =>
    sentenceAllowsInstantCrisis(sentence),
  );
}

/**
 * The rules would have opened the crisis screen, and a sentence marker blocks it.
 * The cue stays. The classifier and the verifier decide.
 */
export function instantCrisisDemoted(question: string): boolean {
  const { tokens } = analyzeQuestion(question);
  return matchSelfHarm(applySelfHarmDenial(tokens)) && !cleanInstantCrisis(question);
}

/**
 * Intent that should compose the crisis block onto an acute screen.
 * The same sentence mask as the instant screen. A clean intent in another
 * sentence still counts. A masked cue does not.
 */
export function selfHarmIntentContext(question: string): boolean {
  if (hasExplicitFigurativeMarker(question)) return false;
  const { tokens, folded } = analyzeQuestion(question);
  if (isSelfHarmInformation(tokens, folded) && !hasTightPersonalPlan(tokens))
    return false;
  if (selfHarmIsPastStable(tokens, folded) && !negatesCurrentPlan(tokens)) return false;
  if (cleanInstantCrisis(question)) return true;
  return splitSentences(question).some((sentence) => {
    const part = analyzeQuestion(sentence);
    if (sentenceHasDemotionMarker(part.tokens, part.folded)) return false;
    return indirectFirstPersonIntent(part.tokens, part.folded);
  });
}

/**
 * Crisis block first, then the acute steps, with the emergency header once.
 * An accompanying acute class plus intent context becomes the crisis screen.
 */
export function presentAcuteScreen(
  riskClass: Exclude<RiskClass, "none">,
  question?: string,
): { riskClass: Exclude<RiskClass, "none">; message: string } {
  if (!question) return { riskClass, message: MESSAGES[riskClass] };
  const { folded } = analyzeQuestion(question);
  const intent = riskClass === "self_harm" || selfHarmIntentContext(question);
  let acute = accompanyingAcute(question);
  if (!acute && riskClass !== "self_harm" && ACCOMPANYING_ACUTE.has(riskClass)) {
    acute = riskClass;
  }
  const accidentalSwallow =
    /\buong nham\b/.test(folded) &&
    !/\b(muon chet|de chet|cho chet|tu sat|khong muon song)\b/.test(folded);
  const poisonSteps = !acute && intent && ingestedHarm(folded) && !accidentalSwallow;
  if (intent && (acute || poisonSteps)) {
    const block = acute ? MESSAGES[acute] : MESSAGES.poisoning;
    return {
      riskClass: "self_harm",
      message: `${MESSAGES.self_harm}\n\n${stepsAfterHeader(block)}`,
    };
  }
  return { riskClass, message: MESSAGES[riskClass] };
}

export function emergencyMessage(
  riskClass: Exclude<RiskClass, "none">,
  question?: string,
): string {
  return presentAcuteScreen(riskClass, question).message;
}

/**
 * Wording that might be self-harm or might be an idiom.
 * The fast path did not take the crisis screen. The classifier decides.
 */
export function selfHarmLooksPastStable(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  return selfHarmIsPastStable(tokens, folded);
}

export function selfHarmLooksInformational(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (hasTightPersonalPlan(tokens)) return false;
  if (evaluateHighRisk(question).riskClass === "self_harm") return false;
  if (selfHarmLooksPastStable(question)) return false;
  return isSelfHarmInformation(tokens, folded);
}

export function selfHarmLooksAmbiguous(question: string): boolean {
  if (evaluateHighRisk(question).riskClass === "self_harm") return false;
  if (selfHarmLooksInformational(question)) return false;
  if (selfHarmLooksPastStable(question)) return false;
  const { tokens, folded } = analyzeQuestion(question);
  if (selfHarmEvidence(tokens).length > 0 && classFullyNegated(tokens, "self_harm")) {
    return false;
  }
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

/**
 * figurative=true is accepted only when the text itself has an idiom:
 * "mệt/cười/nóng muốn chết", other intensifiers, work/heat/laughing hyperbole,
 * "chết ngất", or unaccented "từ từ" meaning slowly.
 */
function thirdPersonIntensifier(folded: string): boolean {
  const subject =
    /\b(no|anh ay|chi ay|ong ay|ba ay|co ay|em be|cau be|dua be|con be|nguoi ta|thang be)\b/.test(
      folded,
    );
  if (!subject) return false;
  if (
    /\b(met|dau|buon|doi|khat|cuoi|nong|ret|so|chan|ghet|tuc|kho|ngai|phien|gian|soc|nung|khoc)\s+(?:\w+\s+){0,2}muon chet\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return /\b(met|dau|buon|doi|cuoi|nong|so|khoc)\s+chet\s+(di|duoc|mat)\b/.test(folded);
}

export function hasExplicitFigurativeMarker(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (thirdPersonIntensifier(folded)) return true;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!matchesTarget(tokens[i]!, "muốn") || !matchesTarget(tokens[i + 1]!, "chết"))
      continue;
    if (isHyperboleWantDie(tokens, i)) return true;
  }
  if (gradualTuTuOnly(tokens)) return true;
  return (
    /\b(chet ngat|cuoi ngat|so ngat|muon ngat)\b/.test(folded) && !realFaintSign(folded)
  );
}

type CueParts = { tokens: SafetyToken[]; folded: string } | null;

/** Shared exits. An idiom, a definition, a hypothetical, or a settled past is not a cue. */
function cueParts(question: string): CueParts {
  const { tokens, folded } = analyzeQuestion(question);
  if (hasExplicitFigurativeMarker(question)) return null;
  if (isSelfHarmInformation(tokens, folded) && !hasTightPersonalPlan(tokens)) return null;
  if (isHypothetical(folded) && !/\b(dang|vua|toi nay|dem nay)\b/.test(folded))
    return null;
  // "không còn" / "no longer" does not hide the cue. Other settled past does.
  if (selfHarmIsPastStable(tokens, folded) && !negatesCurrentPlan(tokens)) return null;
  return { tokens, folded };
}

/**
 * High-precision lexicon. A 2-token denial still hides this flag, so the
 * verifier stays in charge of that class.
 */
export function hasSelfHarmLexicon(question: string): boolean {
  if (instantCrisisDemoted(question)) return false;
  const parts = cueParts(question);
  if (!parts) return false;
  const visible = applySelfHarmDenial(parts.tokens);
  const visibleFolded = visible.map((token) => token.folded).join(" ");
  if (ambiguousSelfHarmCue(visible)) return true;
  if (negatesCurrentPlan(parts.tokens)) return hasSelfHarmTopic(visible, visibleFolded);
  if (matchSelfHarm(visible)) return true;
  return (
    /\b(tu sat|quyen sinh|tuyet menh|khong muon song|khong song noi)\b/.test(
      visibleFolded,
    ) || hasRealSuicidePair(visible)
  );
}

/**
 * A self-harm cue that is not only an idiom, a definition, a hypothetical, or the past.
 * A denial or a minimizer next to an intent cue stays visible. The 2-token window
 * still keeps that denial off the immediate screen.
 */
export function hasSelfHarmCue(question: string): boolean {
  if (hasSelfHarmLexicon(question)) return true;
  if (instantCrisisDemoted(question)) return true;
  const parts = cueParts(question);
  if (!parts) return false;
  if (indirectFirstPersonIntent(parts.tokens, parts.folded)) return true;
  return denialBesideIntent(parts.tokens, parts.folded);
}

/** An emergency picture that should not collapse to the one-line 115 note. */
export function hasAcuteCue(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (isDefinitionQuestion(folded) || (isEducation(folded) && !isSudden(folded)))
    return false;
  if (selfHarmLooksPastStable(question)) return false;
  if (hasSelfHarmCue(question)) return true;
  const masked = applyNegationMask(tokens);
  const maskedFolded = masked.map((token) => token.folded).join(" ");
  if (pickRiskClass(masked, maskedFolded)) return true;
  let picture = maskedFolded;
  if (seizureLooksResolved(question)) {
    picture = picture.replace(/\b(co giat|dong kinh)\b/g, " ");
  }
  return /\b(tim dap|mo hoi lanh|do mo hoi|tuc nguc|dau nguc|kho tho|co giat|bat tinh|chay mau|uong nham|meo mieng)\b/.test(
    picture,
  );
}

/** First person plus a harm-intent cue that is not an idiom, a definition, or the past. */
export function hasFirstPersonHarmIntent(question: string): boolean {
  if (hasExplicitFigurativeMarker(question)) return false;
  const { tokens, folded } = analyzeQuestion(question);
  if (!tokens.some((token) => FIRST_PERSON.has(token.folded))) return false;
  if (selfHarmIsPastStable(tokens, folded)) return false;
  if (isHypothetical(folded) && !/\b(dang|vua|toi nay|dem nay)\b/.test(folded))
    return false;
  if (isSelfHarmInformation(tokens, folded) && !hasTightPersonalPlan(tokens))
    return false;
  return hasSelfHarmLexicon(question);
}

const CUE_CLASSES = [
  "self_harm",
  "severe_allergy",
  "low_blood_sugar",
  "seizure",
  "breathing",
  "choking",
  "chest_pain",
  "burn",
  "poisoning",
  "bleeding",
  "head_injury",
  "unconscious",
  "stroke",
  "fall_emergency",
] as const;

/** Classes with a lexicon or rule cue in the text, after negation is masked. */
export function corroboratingCues(question: string): Array<(typeof CUE_CLASSES)[number]> {
  const { tokens } = analyzeQuestion(question);
  const masked = applyNegationMask(tokens);
  const maskedFolded = masked.map((token) => token.folded).join(" ");
  return CUE_CLASSES.filter((riskClass) => matchesClass(riskClass, masked, maskedFolded));
}
