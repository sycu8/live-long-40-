import { foldVietnamese } from "../utils/vietnamese";

export const SAFETY_RULESET_VERSION = "v1.3.0";

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

export function analyzeQuestion(question: string): {
  tokens: SafetyToken[];
  folded: string;
  accented: string;
} {
  const accented = question.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const raw = accented.match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens: SafetyToken[] = raw.map((word) => {
    const telex = decodeTelexStem(word);
    if (telex) {
      return { accented: word, folded: foldVietnamese(telex), toned: false };
    }
    return {
      accented: word,
      folded: foldVietnamese(word),
      toned: TONE.test(word),
    };
  });
  return {
    tokens,
    folded: tokens.map((token) => token.folded).join(" "),
    accented,
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

const HYPERBOLE = new Set([
  "nong",
  "met",
  "cuoi",
  "doi",
  "so",
  "buon",
  "khat",
  "vui",
  "lung",
  "bung",
  "vai",
  "chan",
  "dau",
]);

function matchSelfHarm(tokens: SafetyToken[]): boolean {
  const joined = tokens.map((token) => token.folded).join(" ");
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
    const tu = tokens[i]!;
    const tu2 = tokens[i + 1]!;
    const pairIsTuTu =
      (!tu.toned && tu.folded === "tu" && !tu2.toned && tu2.folded === "tu") ||
      (tu.toned && tu.accented === "tự" && tu2.toned && tu2.accented === "tử");
    if (!pairIsTuTu) continue;
    if (nearFolded(tokens, i, ["toi", "em", "minh", "muon", "dinh", "tinh"], 5))
      return true;
  }

  if (hasPhrase(tokens, "tự sát") || hasPhrase(tokens, "tự làm hại")) return true;

  for (let i = 0; i < tokens.length - 1; i++) {
    const want = tokens[i]!;
    const die = tokens[i + 1]!;
    const isWantDie =
      ((want.toned && want.accented === "muốn") ||
        (!want.toned && want.folded === "muon")) &&
      ((die.toned && die.accented === "chết") || (!die.toned && die.folded === "chet"));
    if (!isWantDie) continue;
    const prev = tokens[i - 1];
    const prev2 = tokens[i - 2];
    if (prev && HYPERBOLE.has(prev.folded)) continue;
    if (prev2 && prev && prev.folded === "lung" && prev2.folded === "dau") continue;
    if (hasPhrase(tokens, "muốn chết cho xong")) return true;
    if (
      nearFolded(
        tokens,
        i,
        ["toi", "em", "minh", "ong", "ba", "bo", "me", "noi", "bao"],
        6,
      )
    ) {
      return true;
    }
  }

  if (hasPhrase(tokens, "đi theo") && /\bcho xong\b/.test(joined)) return true;

  if (/\bket thuc tat ca\b/.test(joined)) {
    const at = joined.indexOf("ket thuc tat ca");
    const after = joined.slice(at + "ket thuc tat ca".length).trim();
    const next = after.split(" ")[0] ?? "";
    if (
      !["cac", "khoan", "no", "cong", "viec", "thoi", "quen", "du", "an", "bai"].includes(
        next,
      )
    ) {
      return true;
    }
  }

  if (
    /\b(uong het thuoc ngu|dinh uong het thuoc)\b/.test(joined) &&
    /\b(khong day|ngu luon|tu tu|ket thuc|muon chet)\b/.test(joined)
  ) {
    return true;
  }

  // "chán đời" alone is an idiom. A self-harm hint beside it still counts.
  if (
    hasPhrase(tokens, "chán đời") &&
    /\b(muon chet|tu tu|khong muon song|bien mat|ket thuc|thuoc ngu)\b/.test(joined)
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
  return /\b(lo mo|lu lan|noi lan|noi lap|run|va mo hoi|khong tinh|met la|hon me|bat tinh|mo hoi)\b/.test(
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
    /\b(sung moi|sung luoi|sung hong|sung mat|mat sung|sung phu|phu mat|phu moi|noi man|me day|sung to)\b/.test(
      folded,
    );
  const airway = /\b(kho tho|tho kho khe|khong tho|choang|mat tim)\b/.test(folded);
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
  return /\b(dau|tuc|that|nhoi|nang|siet)\s+nguc\b/.test(folded);
}

function matchBreathing(folded: string): boolean {
  if (
    /\b(tho khong noi|khong tho noi|khong tho duoc|tho khong ra hoi|tho rit|tho hon hen|con hen nang|hen nang|ngat tho|moi tim|tim tai|moi tai xanh|mat tim)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\bkho tho\b/.test(folded) &&
    /\b(nang|du doi|rit|hon hen|khong do|dot nhien|dang|nua tieng)\b/.test(folded)
  ) {
    return true;
  }
  return false;
}

function matchSeizure(folded: string): boolean {
  if (/\bhay co giat\b/.test(folded)) return false;
  return /\b(dang co giat|bi co giat|len con co giat|len con dong kinh|sui bot mep|co giat)\b/.test(
    folded,
  );
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
  return /\b(chay mau nhieu|chay mau khong cam|chay mau o at|chay mau khong dung|non ra mau|oi ra mau|di ngoai ra mau|ho ra mau|dai tien ra mau|xuat huyet nang|mau chay nhieu)\b/.test(
    folded,
  );
}

function matchUnconscious(tokens: SafetyToken[], folded: string): boolean {
  if (
    /\b(bat tinh|mat y thuc|khong danh thuc|khong tinh lai|lim di|khong phan ung|goi khong tra loi|nam im|goi khong tinh|khong day)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (hasPhrase(tokens, "ngất") || hasPhrase(tokens, "xỉu")) return true;
  if (/\bxiu\b/.test(folded)) return true;
  if (/\bngat\b/.test(folded) && !/\bngat tho\b/.test(folded)) {
    const onlyTonedNgat = tokens.some(
      (token) => token.toned && token.accented === "ngạt",
    );
    const hasFaint = tokens.some(
      (token) =>
        (token.toned && token.accented === "ngất") ||
        (!token.toned && token.folded === "ngat"),
    );
    if (hasFaint && !onlyTonedNgat) return true;
    if (hasFaint && tokens.some((token) => token.toned && token.accented === "ngất"))
      return true;
  }
  if (/\bkhong tinh\b/.test(folded) && !/\bvan tinh\b/.test(folded)) return true;
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
    /\b(meo mieng|mieng meo|meo mom|noi ngong|noi khong ro|mat lech|lech mieng|meo mat|mieng lech|noi lap|xe mot ben mat|xe mat|noi dot|noi do|noi u o|te nua mat|nhin mo dot|cuoi meo|liet mat|yeu mot ben|yeu nua|liet nua|liet mot ben)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (
    /\b(yeu|liet)\s+(nua|mot ben|nua nguoi)\b/.test(folded) ||
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
  if (/\b(bi nga|vua nga|nga cau|nga xuong|nga trong|nga)\b/.test(folded)) return true;
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
  const red =
    /\b(khong dung|khong cu dong|khong di duoc|chan lech|dau hang|dau hong|dau khop hang|te|liet|lech|khong nhac)\b/.test(
      folded,
    );
  if (!down || /\bphong nga\b/.test(folded)) return false;
  if (mild && !/\b(khong dung|khong cu dong|dap dau|chay mau)\b/.test(folded))
    return false;
  if (/\bkhong\s+(?:tu\s+|the\s+)?dung\s+(?:day|len)(?:\s+duoc)?\b/.test(folded))
    return true;
  if (red) return true;
  return false;
}

/** Advice about prevention or a stable condition, with no event happening now. */
function isEducation(folded: string): boolean {
  const happening =
    /\b(tu nhien|bong dung|bong|dot nhien|dot ngot|vua nga|vua bi|tu sang|nua tieng|du doi|va mo hoi|khong tho duoc|khong dung|bat tinh|lo mo|khong tinh|chay mau|non ra mau|oi ra|mac nghen|bi nghen|bi hoc|uong nham|qua lieu|ca vi|thuoc tru sau|thuoc diet|meo mieng|mieng meo|noi ngong|mat lech|mieng lech|co giat|ngat|xiu|lim di|khong phan ung|tuc nguc|dau nguc|that nguc|nhoi nguc|kho tho|noi lap|yeu nua|yeu mot|dap dau)\b/.test(
      folded,
    );
  const manage =
    /\b(nen tap|nen an|cham soc|vat ly tri lieu|phong nga|phong dot|phong ngua|de phong|ngan ngua|tranh bi|tranh hoc|cach so cuu|co nen|khi gang suc|dinh ky|hay kho tho|hay co giat|hay bi te|hay bi chong|co nguy hiem khong|co de bi|co sao khong|co tot khong|de khong gay|uong thuoc deu|ngay xua|nam truoc|co phai)\b/.test(
      folded,
    );
  if (happening && !manage) return false;
  return (
    manage || /\b(dau hieu\b.*\bla gi\b|on dinh nen|lau nam\b.*\bcham soc)\b/.test(folded)
  );
}

export const SYMPTOM_SAFETY_LINE = "Nếu có dấu hiệu nguy hiểm, gọi ngay 115.";

const SYMPTOM_WORDS = new Set([
  "đau",
  "ngực",
  "ngã",
  "tê",
  "thở",
  "mệt",
  "nóng",
  "ho",
  "chóng",
  "sốt",
  "nôn",
  "máu",
  "choáng",
  "sưng",
  "lịm",
  "run",
]);

const SYMPTOM_FOLDED = new Set([
  "dau",
  "nguc",
  "nga",
  "te",
  "tho",
  "met",
  "nong",
  "ho",
  "chong",
  "sot",
  "non",
  "mau",
  "ngat",
  "xiu",
  "giat",
  "nghen",
  "choang",
  "sung",
  "phu",
  "lech",
  "ngong",
  "liet",
  "run",
  "oi",
  "lim",
]);

export function questionMentionsSymptom(question: string): boolean {
  const { tokens, folded } = analyzeQuestion(question);
  if (
    /\b(kho tho|dau nguc|tuc nguc|buon non|lo mo|lu lan|duong huyet|tieu duong|chay mau|meo mieng|co giat|bat tinh)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return tokens.some((token) => {
    if (token.toned) return SYMPTOM_WORDS.has(token.accented);
    return SYMPTOM_FOLDED.has(token.folded);
  });
}

/** @deprecated Use questionMentionsSymptom. Kept so callers can ask about a near miss. */
export function isRedFlagAdjacent(question: string): boolean {
  return questionMentionsSymptom(question) && !evaluateHighRisk(question).matched;
}

export function evaluateHighRisk(question: string): SafetyMatch {
  const { tokens, folded } = analyzeQuestion(question);
  let riskClass: Exclude<RiskClass, "none"> | null = null;
  if (matchSelfHarm(tokens)) riskClass = "self_harm";
  else if (matchChoking(tokens, folded)) riskClass = "choking";
  else if (matchGlucose(folded)) riskClass = "low_blood_sugar";
  else if (matchAllergy(folded)) riskClass = "severe_allergy";
  else if (matchChest(folded)) riskClass = "chest_pain";
  else if (matchBreathing(folded)) riskClass = "breathing";
  else if (matchSeizure(folded)) riskClass = "seizure";
  else if (matchPoison(folded)) riskClass = "poisoning";
  else if (matchBleeding(folded)) riskClass = "bleeding";
  else if (matchHead(folded)) riskClass = "head_injury";
  else if (matchUnconscious(tokens, folded)) riskClass = "unconscious";
  else if (matchStroke(folded)) riskClass = "stroke";
  else if (matchFall(tokens, folded)) riskClass = "fall_emergency";

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
