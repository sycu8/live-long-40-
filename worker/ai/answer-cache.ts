import { ANSWER_BANK, type AnswerBankEntry } from "@shared/content/answer-bank";
import { isGenericHomepageUrl } from "@shared/content/official-sources";
import {
  GENTLE_SUPPORT_LINE,
  POST_SEIZURE_CHECK_LINE,
  SYMPTOM_SAFETY_LINE,
} from "@shared/rules/safety";
import { foldVietnamese } from "@shared/utils/vietnamese";
import {
  containsToken,
  completeHttpUrl,
  isCompleteHttpUrl,
  isHostOnlyUrl,
  MIN_RETRIEVAL_SCORE,
  sourceMatchesQuestionTopic,
} from "./local-retrieve";
import type { QuestionClassification } from "@shared/constants/product";
import { answerHasCitations, sourceLooksOfficial } from "@shared/rules/sources";
import type { Env } from "../env";
import { WORKERS_AI_TEXT_MODEL } from "./models";

export type CachedSource = {
  key: string;
  sourceId?: string;
  chunkId?: string;
  title: string;
  issuer: string;
  publicationDate?: string;
  url?: string;
  snippet: string;
  score: number;
  status?: string;
  trustTier?: string;
};

export type CachedAnswer = {
  entryId?: string;
  classification: QuestionClassification;
  answer: string;
  sources: CachedSource[];
  mode: "answer_bank" | "kv_cache";
  cachedAt: string;
};

// v7 does not read v6. Care-downgrade answers were stored for 7 days under v6.
// Those keys stay until TTL and are never replayed.
const CACHE_PREFIX = "ans_cache:v7:";
/** New writes expire in 7 days. Older v6 values are never read. */
export const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function cacheKeyForQuestion(question: string): string {
  const folded = foldVietnamese(question).replace(/\s+/g, " ").trim();
  return `${CACHE_PREFIX}${WORKERS_AI_TEXT_MODEL}:${djb2(folded)}`;
}

function aliasScore(foldedQuery: string, alias: string): number {
  const a = alias.trim();
  if (!a) return 0;
  if (foldedQuery === a) return 1;
  if (a.includes(foldedQuery) && foldedQuery.length / a.length >= 0.62) return 0.9;
  if (foldedQuery.includes(a)) {
    const ratio = a.length / foldedQuery.length;
    // A short alias inside a longer, different question is not a match.
    if (ratio < 0.62) return 0;
    return 0.72 + ratio * 0.2;
  }
  const qTokens = foldedQuery.split(/\s+/).filter((t) => t.length >= 3);
  const aTokens = a.split(/\s+/).filter((t) => t.length >= 3);
  if (aTokens.length === 0 || qTokens.length === 0) return 0;
  let hits = 0;
  for (const t of aTokens) {
    if (qTokens.includes(t)) hits += 1;
  }
  const aliasCovered = hits / aTokens.length;
  const queryCovered = qTokens.filter((t) => aTokens.includes(t)).length / qTokens.length;
  return aliasCovered >= 0.7 && queryCovered >= 0.55 ? 0.55 + aliasCovered * 0.2 : 0;
}

/** Find the best curated answer for a user question. */
export function matchAnswerBank(
  question: string,
  minScore = 0.7,
): AnswerBankEntry | null {
  const folded = foldVietnamese(question).replace(/\s+/g, " ").trim();
  if (!folded) return null;

  let best: { entry: AnswerBankEntry; score: number } | null = null;
  for (const entry of ANSWER_BANK) {
    let score = aliasScore(folded, foldVietnamese(entry.question));
    for (const alias of entry.aliases) {
      score = Math.max(score, aliasScore(folded, foldVietnamese(alias)));
    }
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }
  if (!best || best.score < minScore) return null;
  return best.entry;
}

export function bankEntryToCached(entry: AnswerBankEntry): CachedAnswer {
  const sources: CachedSource[] = entry.sources.map((s, i) => ({
    key: `S${i + 1}`,
    title: s.title,
    issuer: s.issuer,
    publicationDate: s.publicationDate,
    url: s.url,
    snippet: s.snippet,
    score: 1,
    status: "active",
    trustTier: s.trustTier,
    sourceId: s.officialSourceId
      ? `official:${s.officialSourceId}`
      : `bank:${entry.id}:${i + 1}`,
  }));
  return {
    entryId: entry.id,
    classification: entry.classification,
    answer: entry.answer,
    sources,
    mode: "answer_bank",
    cachedAt: new Date().toISOString(),
  };
}

export function answerHasInvalidCitations(
  answer: string,
  sources: Array<{ key: string }>,
): boolean {
  const keys = new Set(sources.map((source) => source.key));
  return [...answer.matchAll(/\[(S\d+)\]/g)].some((match) => !keys.has(match[1] ?? ""));
}

export function stripInvalidCitationMarkers(
  answer: string,
  sources: Array<{ key: string }>,
): string {
  const keys = new Set(sources.map((source) => source.key));
  return answer
    .replace(/\[(S\d+)\]/g, (marker, key: string) => (keys.has(key) ? marker : ""))
    .replace(/[ \t]{2,}/g, " ");
}

type IssuerKind = "byt" | "who" | "bhxh" | "sbv";

function issuerKind(issuer: string): IssuerKind | null {
  if (/bộ\s*y\s*tế/i.test(issuer)) return "byt";
  if (/tổ\s*chức\s*y\s*tế\s*thế\s*giới|\bwho\b/i.test(issuer)) return "who";
  if (/bảo\s*hiểm\s*xã\s*hội/i.test(issuer)) return "bhxh";
  if (/ngân\s*hàng\s*nhà\s*nước/i.test(issuer)) return "sbv";
  return null;
}

const ISSUER_MENTIONS: Array<{ kind: IssuerKind; pattern: RegExp }> = [
  { kind: "byt", pattern: /bộ\s*y\s*tế/i },
  { kind: "who", pattern: /tổ\s*chức\s*y\s*tế\s*thế\s*giới|\bwho\b/i },
  { kind: "bhxh", pattern: /bảo\s*hiểm\s*xã\s*hội/i },
  { kind: "sbv", pattern: /ngân\s*hàng\s*nhà\s*nước/i },
];

/** A period inside a URL stays; the period after "URL." still ends the sentence. */
const URL_IN_SENTENCE = /https?:\/\/(?:[^\s)>\].]|[.](?!\s|$))+/gi;

function answerSentences(answer: string): string[] {
  const urls: string[] = [];
  const masked = answer
    .replace(/(^|[\s(])((?:TP|TS|BS|GS|PGS|ThS|Mr|Dr|St|vs))(\.)/gi, "$1$2\uE000")
    .replace(URL_IN_SENTENCE, (url) => {
      urls.push(url);
      return ` URL${urls.length - 1}TOKEN `;
    });
  const parts = masked
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && /^(?:\[S\d+\]\s*)+$/.test(part)) {
      merged[merged.length - 1] += ` ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged.map((part) =>
    part
      .replace(/URL(\d+)TOKEN/g, (_, index: string) => urls[Number(index)] ?? "")
      .replace(/\uE000/g, "."),
  );
}

function collapseCitationMarkers(text: string): string {
  return text.replace(/(\[S\d+\])(?:\s*\1)+/g, "$1");
}

function claimNumbers(sentence: string): string[] {
  const withoutMarkers = sentence.replace(/\[S\d+\]/g, " ");
  return [...withoutMarkers.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    (match[0] ?? "").replace(",", "."),
  );
}

function textHasNumber(text: string, number: string): boolean {
  const escaped = number.replace(/[.]/g, "\\.");
  return new RegExp(`(?<![\\d])${escaped}(?![\\d])`).test(text);
}

function numberIsSupported(
  number: string,
  sentence: string,
  sources: Array<{
    key: string;
    title: string;
    snippet: string;
    publicationDate?: string;
  }>,
  question: string,
): boolean {
  if (textHasNumber(question, number)) return true;
  const citedKeys = [...sentence.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
  const pool = sources.filter((source) =>
    citedKeys.length === 0 ? true : citedKeys.includes(source.key),
  );
  return pool.some((source) =>
    textHasNumber(
      `${source.title}\n${source.snippet}\n${source.publicationDate ?? ""}`,
      number,
    ),
  );
}

const OUTSIDE_MARKERS = [
  "nghien cuu",
  "thu nghiem",
  "study",
  "lancet",
  "meta-analysis",
  "meta analysis",
  "cochrane",
  "clinical trial",
  "pubmed",
];

/** Stop or change medication. Allowed only when a cited chunk says so. */
const MEDICATION_CHANGE =
  /ngung thuoc|doi thuoc|thay thuoc|giam lieu|tang lieu|bo thuoc|cat thuoc|tu y ngung|tu y doi|tu y thay|dieu chinh lieu|stop (?:the |your )?(?:medication|medicine|drug)s?|chang(?:e|ing) (?:your )?(?:medication|medicine|dose)|discontinu/;

const JUNK_TEXT =
  /```|\bundefined\b|\bas an ai\b|\bas a language model\b|tôi là một (?:mô hình|trợ lý)|i am an ai/i;

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A citation marker or a "Nguồn:" header, with no claim left beside it. */
export function isCitationOnly(text: string): boolean {
  const folded = foldVietnamese(text);
  const hasMarker = /\[s\d+\]/.test(folded);
  const header = /\b(nguon|sources?|references?|citations?)\b/.test(folded);
  if (!hasMarker && !header) return false;
  return contentTokens(text).length === 0;
}

function hasMedicationChange(text: string): boolean {
  return MEDICATION_CHANGE.test(foldVietnamese(text));
}

function medicationChangeIsSupported(
  text: string,
  cited: Array<{ title: string; snippet: string }>,
): boolean {
  if (!hasMedicationChange(text)) return true;
  const blob = foldVietnamese(
    cited.map((source) => `${source.title}\n${source.snippet}`).join("\n"),
  );
  return MEDICATION_CHANGE.test(blob);
}

/** Share of content words a paraphrase must share with the cited snippet. */
export const PARAPHRASE_OVERLAP = 0.34;

export type SentenceDropReason =
  | "junk"
  | "refusal"
  | "model_115"
  | "citation_only"
  | "invalid_citation"
  | "outside_source"
  | "truncated_url"
  | "medication"
  | "number"
  | "low_overlap"
  | "uncited"
  | "care_avoidance"
  | "meta"
  | "echo"
  | "header"
  | "issuer_tag"
  | "rhetorical";

/** Whitespace and surrounding punctuation only. Diacritics stay, so "hay" ≠ "hãy". */
function normalizeClause(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\[S\d+\]/gi, " ")
    .replace(/[“”«»"'`]/g, "")
    .replace(/[.!?…]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * A phone instruction, not a factual 115 in a reading.
 * "gọi 115" counts. "Điều 115" and "115 triệu" do not.
 */
export function mentionsEmergencyNumber(text: string): boolean {
  const folded = foldVietnamese(text).replace(/['’]/g, "");
  return /(?:goi|call|dial|tong dai|so dien thoai|lien he|cap cuu)\s+(?:ngay\s+|so\s+)?115\b/.test(
    folded,
  );
}

const HAS_ACCENT =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i;

/**
 * Care / medical-help, as a class. Matching is by role (the word is a way to
 * get checked), not by a list of whole sentences.
 */
function isCareWord(words: string[], index: number): boolean {
  const word = words[index] ?? "";
  const pair = `${word} ${words[index + 1] ?? ""}`;
  const triple = `${pair} ${words[index + 2] ?? ""}`;
  if (
    triple === "xe cap cuu" ||
    triple === "tro giup y" ||
    pair === "cap cuu" ||
    pair === "bac si" ||
    pair === "benh vien" ||
    pair === "phong kham" ||
    pair === "y te" ||
    pair === "kiem tra" ||
    pair === "medical help" ||
    pair === "urgent care" ||
    pair === "check up"
  ) {
    return true;
  }
  return (
    word === "kham" ||
    word === "emergency" ||
    word === "ambulance" ||
    word === "exam" ||
    word === "checkup" ||
    word === "doctor" ||
    word === "hospital" ||
    word === "clinic" ||
    word === "physician" ||
    word === "er" ||
    word === "115"
  );
}

function clauseWords(clause: string): string[] {
  return foldVietnamese(clause)
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "đừng" folds to the same string as "dụng". "sử dụng" is not a negator. */
function isNegator(words: string[], index: number, clause: string): boolean {
  const word = words[index] ?? "";
  if (word === "not" || word === "no" || word === "never" || word === "without") return true;
  if (word === "dont") return true;
  if (word === "khong" || word === "chua" || word === "chang" || word === "khoi") return true;
  if (word !== "dung") return false;
  if (words[index - 1] === "su" || words[index - 1] === "noi" || words[index - 1] === "ung")
    return false;
  if (words[index + 1] === "cu") return false;
  if (/đừng/i.test(clause)) return true;
  return !HAS_ACCENT.test(clause);
}

function phraseAt(words: string[], index: number, phrase: string): boolean {
  const parts = phrase.split(" ");
  return parts.every((part, offset) => words[index + offset] === part);
}

/** Negation aimed at getting help: "không cần", "no need", "not necessary", "đừng". */
function careNegationBefore(words: string[], careIndex: number, clause: string): boolean {
  const window = words.slice(Math.max(0, careIndex - 6), careIndex);
  if (window.includes("hay") || window.includes("nen") || window.includes("should")) return false;
  for (let i = 0; i < window.length; i += 1) {
    const at = Math.max(0, careIndex - window.length) + i;
    if (!isNegator(words, at, clause)) continue;
    const next = words.slice(at + 1, at + 4).join(" ");
    // "không bỏ qua" / "đừng chờ" negate the delay, not the care.
    if (/^(?:bo qua|skip|doi|cho|wait|nghi)\b/.test(next)) continue;
    return true;
  }
  const joined = window.join(" ");
  return /no need|not necessary|not needed|do not need|dont need|unnecessary/.test(joined);
}

function hasUnnegatedDelay(words: string[], clause: string): boolean {
  const delayAt = (index: number): boolean => {
    if (phraseAt(words, index, "ngay mai")) return true;
    if (phraseAt(words, index, "hom sau")) return true;
    if (phraseAt(words, index, "de sau")) return true;
    if (phraseAt(words, index, "lat nua")) return true;
    if (phraseAt(words, index, "vai ngay")) return true;
    if (phraseAt(words, index, "few days")) return true;
    if (phraseAt(words, index, "a few")) return words[index + 2] === "days";
    const word = words[index] ?? "";
    if (word === "tomorrow" || word === "later" || word === "postpone") return true;
    if (word === "wait") return true;
    // "đợi"/"chờ" fold together with "đời"/"cho" (for). Use the accent when it is there.
    if (word === "doi") {
      if (/đợi/i.test(clause)) return true;
      return !HAS_ACCENT.test(clause);
    }
    if (word === "cho") {
      if (/chờ/i.test(clause)) return true;
      if (HAS_ACCENT.test(clause)) return false;
      const next = words[index + 1] ?? "";
      const prev = words[index - 1] ?? "";
      return next === "o" || next === "den" || next === "them" || next === "vai" || prev === "cu" || prev === "hay";
    }
    // "đi khám sau" / "sau hãy đi khám". "sau khi" is only sequence.
    if (
      word === "sau" &&
      words[index + 1] !== "khi" &&
      (index === words.length - 1 || words[index + 1] === "hay" || words[index + 1] === "moi")
    ) {
      return true;
    }
    return false;
  };
  for (let i = 0; i < words.length; i += 1) {
    if (!delayAt(i)) continue;
    const prev = i - 1;
    if (prev >= 0 && isNegator(words, prev, clause)) continue;
    return true;
  }
  return false;
}

function hasUnnegatedMinimiser(words: string[]): boolean {
  const joined = ` ${words.join(" ")} `;
  const patterns = [
    " bo qua ",
    " skip ",
    " just rest ",
    " cu nghi ",
    " chi can nghi ",
    " nghi o nha ",
    " cu o nha ",
    " cho o nha ",
    " doi o nha ",
    " stay home ",
    " just wait ",
    " wait at home ",
    " unnecessary ",
    " khong sao ",
  ];
  for (const pattern of patterns) {
    const at = joined.indexOf(pattern);
    if (at < 0) continue;
    const before = joined.slice(0, at).trim().split(/\s+/);
    const prev = before[before.length - 1] ?? "";
    if (prev === "khong" || prev === "dung" || prev === "dont" || prev === "never" || prev === "not")
      continue;
    return true;
  }
  if (/theo doi them o nha/.test(words.join(" "))) return true;
  return false;
}

function clauseAvoidsCare(clause: string): boolean {
  const words = clauseWords(clause);
  if (words.length === 0) return false;
  const joined = words.join(" ");
  // Waiting at home or "just rest" is itself the deferral.
  if (
    /(?:cu o nha|cho o nha|doi o nha|nghi o nha|just rest|just wait|stay home|wait at home|cu nghi|theo doi them o nha)/.test(
      joined,
    ) &&
    hasUnnegatedMinimiser(words)
  ) {
    return true;
  }
  let care = false;
  for (let i = 0; i < words.length; i += 1) {
    if (!isCareWord(words, i)) continue;
    care = true;
    if (careNegationBefore(words, i, clause)) return true;
    const after = words.slice(i + 1, i + 6).join(" ");
    if (/not necessary|not needed|unnecessary|no need|khong can|khong nen/.test(after)) return true;
  }
  if (!care) return false;
  if (hasUnnegatedDelay(words, clause)) return true;
  if (hasUnnegatedMinimiser(words)) return true;
  return false;
}

function clauseParts(sentence: string): string[] {
  const parts = sentence
    .split(/[,;]|(?:\s+nhưng\s+)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [sentence];
}

/**
 * Care or medical help combined with negation, minimisation, or delay.
 * "Hãy đi khám" and "Không bỏ qua việc đi khám" do not match.
 * "Ngày mai hãy đi khám" does: that is care deferred until later.
 */
export function postponesSeekingCare(sentence: string): boolean {
  return clauseParts(sentence).some(clauseAvoidsCare);
}

/** Positive care clauses kept when the same sentence also talks the user out of care. */
function positiveCareRemainder(sentence: string): string {
  const kept = clauseParts(sentence).filter((part) => !clauseAvoidsCare(part));
  return kept.join(", ").trim();
}

export function answerPostponesCare(answer: string): boolean {
  return answerSentences(answer).some(
    (sentence) => !isSystemSafetyLine(sentence) && postponesSeekingCare(sentence),
  );
}

function isSystemSafetyLine(sentence: string): boolean {
  const norm = normalizeClause(sentence);
  return [SYMPTOM_SAFETY_LINE, POST_SEIZURE_CHECK_LINE, GENTLE_SUPPORT_LINE].some(
    (line) => normalizeClause(line) === norm,
  );
}

const AFFIRMATIVE_TEMPLATES = [
  "hãy gọi 115 ngay",
  "hãy gọi ngay 115",
  "gọi 115 ngay",
  "gọi ngay 115",
];

/** Unaccented forms that do not contain "hay", so they cannot collide with "hãy". */
const PLAIN_TEMPLATES = [
  "goi 115 ngay",
  "goi ngay 115",
  "neu co dau hieu nguy hiem, goi ngay 115",
];

const CONDITION_HEDGE =
  /(?:^|[\s,])(?:hoặc|hay|có thể|co the|không|khong|chẳng|chang|chưa|chua|đừng|đưng|dung|khỏi|khoi|unless|don't|dont)(?:[\s,]|$)/i;

function conditionalBacked(
  norm: string,
  sources: Array<{ title: string; snippet: string }>,
): boolean {
  const match = /^(?:gọi 115 ngay nếu|goi 115 ngay neu)\s+(.+)$/.exec(norm);
  if (!match) return false;
  const condition = match[1] ?? "";
  if (CONDITION_HEDGE.test(condition)) return false;
  const tokens = contentTokens(condition);
  if (tokens.length === 0) return false;
  const blob = foldVietnamese(
    sources.map((source) => `${source.title}\n${source.snippet}`).join("\n"),
  );
  return tokens.every((token) => containsToken(blob, token));
}

/**
 * Exact affirmative 115 wording. Accent-sensitive on purpose: folding "hãy"
 * and "hay" together is what let an either/or sentence through.
 */
export function isAffirmativeSafetyTemplate(
  sentence: string,
  sources: Array<{ title: string; snippet: string }> = [],
): boolean {
  if (isSystemSafetyLine(sentence)) return true;
  const norm = normalizeClause(sentence);
  if (AFFIRMATIVE_TEMPLATES.includes(norm)) return true;
  const folded = foldVietnamese(norm);
  if (norm === folded && PLAIN_TEMPLATES.includes(folded)) return true;
  return conditionalBacked(norm, sources);
}

/** A cached answer may include only the 115 line the system itself appended. */
export function answerHasModelEmergency(answer: string): boolean {
  return answerSentences(answer).some(
    (sentence) => mentionsEmergencyNumber(sentence) && !isSystemSafetyLine(sentence),
  );
}

function citedBlob(
  sources: Array<{ issuer: string; title: string; snippet: string; url?: string }>,
): string {
  return sources
    .map(
      (source) =>
        `${source.issuer}\n${source.title}\n${source.snippet}\n${source.url ?? ""}`,
    )
    .join("\n");
}

/** A claim has to share content words with the chunk it cites. */
function claimBackedByCited(
  sentence: string,
  cited: Array<{ title: string; snippet: string }>,
): boolean {
  const tokens = contentTokens(sentence);
  // A citation marker or a source header alone is not a claim.
  if (tokens.length === 0) return false;
  const haystack = foldVietnamese(
    cited.map((source) => `${source.title}\n${source.snippet}`).join("\n"),
  );
  const claims = tokens.filter((token) => !LIGHT_CLAIM.has(token));
  const checked = claims.length > 0 ? claims : tokens;
  const hits = checked.filter((token) => containsToken(haystack, token));
  // A shared topic word is not enough. Most of the claim has to be in the passage.
  return hits.length / checked.length >= 0.7;
}

function overlapRatio(
  sentence: string,
  cited: Array<{ title: string; snippet: string }>,
): number {
  const tokens = contentTokens(sentence);
  if (tokens.length === 0) return 0;
  const haystack = foldVietnamese(
    cited.map((source) => `${source.title}\n${source.snippet}`).join("\n"),
  );
  const hits = tokens.filter((token) => containsToken(haystack, token));
  return hits.length / tokens.length;
}

/** Light verbs and function words. They do not make a WHO passage "support" a new claim. */
const LIGHT_CLAIM = new Set([
  "bang",
  "giup",
  "cach",
  "cung",
  "hoac",
  "neu",
  "vao",
  "roi",
  "nay",
  "nua",
  "rat",
  "minh",
  "ban",
  "khi",
  "voi",
  "duoc",
]);

const GENERIC_CLAIM = new Set([
  "nguoi",
  "tuoi",
  "nhieu",
  "moi",
  "ngay",
  "theo",
  "trong",
  "khong",
  "duoc",
  "nen",
]);

/** Labels such as "Nguồn:" are not claims, even when the snippet repeats them. */
const HEADER_TOKEN = new Set([
  "nguon",
  "source",
  "sources",
  "reference",
  "references",
  "citation",
  "citations",
]);

function contentTokens(text: string): string[] {
  return foldVietnamese(text)
    .replace(/\[s\d+\]/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 4 && !GENERIC_CLAIM.has(token) && !HEADER_TOKEN.has(token),
    );
}

function isSourceRefusal(text: string): boolean {
  const folded = foldVietnamese(text).replace(/['’]/g, "");
  return /chua tim thay du nguon|khong du nguon|not enough|insufficient sources|cannot find|cant find/.test(
    folded,
  );
}

function mentionsOutsideSource(
  sentence: string,
  cited: Array<{ issuer: string; title: string; snippet: string; url?: string }>,
): boolean {
  const blob = citedBlob(cited);
  const foldedBlob = foldVietnamese(blob);
  const urls = sentence.match(/https?:\/\/[^\s)\]]+/gi) ?? [];
  for (const url of urls) {
    const clean = url.replace(/[.,;:!?)]+$/g, "");
    if (!isCompleteHttpUrl(clean)) return true;
    if (!blob.includes(clean) && !isHostOnlyUrl(clean)) return true;
    if (isHostOnlyUrl(clean)) {
      try {
        const host = new URL(clean).hostname;
        if (!blob.includes(host)) return true;
      } catch {
        return true;
      }
      continue;
    }
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escaped}\\S`).test(blob)) return true;
  }
  const foldedSentence = foldVietnamese(sentence);
  for (const marker of OUTSIDE_MARKERS) {
    if (foldedSentence.includes(marker) && !foldedBlob.includes(marker)) return true;
  }
  const named = ISSUER_MENTIONS.filter((mention) => mention.pattern.test(sentence));
  for (const mention of named) {
    if (!cited.some((source) => issuerKind(source.issuer) === mention.kind)) return true;
  }
  return false;
}

type SupportSource = {
  key: string;
  issuer: string;
  title: string;
  snippet: string;
  publicationDate?: string;
  url?: string;
};

function repairUrls(
  sentence: string,
  sources: SupportSource[],
): { text: string; droppedUrl: boolean } {
  let droppedUrl = false;
  const known = sources
    .map((source) => source.url)
    .filter((url): url is string => Boolean(url));
  const text = sentence.replace(/https?:\/\/[^\s)>\]]+/gi, (raw) => {
    const url = completeHttpUrl(raw);
    if (!url) {
      droppedUrl = true;
      return "";
    }
    const truncatedPath =
      !isHostOnlyUrl(url) &&
      known.some((source) => source.length > url.length && source.startsWith(url));
    const cut = truncatedPath;
    if (cut) {
      droppedUrl = true;
      return "";
    }
    return url;
  });
  return {
    text: text
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\(\s*\)/g, "")
      .trim(),
    droppedUrl,
  };
}

function supportFailure(
  probe: string,
  sources: SupportSource[],
  question: string,
): SentenceDropReason | null {
  if (JUNK_TEXT.test(probe) || isCitationOnly(probe)) return "citation_only";
  if (answerHasInvalidCitations(probe, sources)) return "invalid_citation";
  const citedKeys = [...probe.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
  const cited = sources.filter((source) => citedKeys.includes(source.key));
  if (cited.length === 0) return "uncited";
  if (mentionsOutsideSource(probe, cited)) return "outside_source";
  if (!medicationChangeIsSupported(probe, cited)) return "medication";
  if (
    !claimNumbers(probe).every((number) =>
      numberIsSupported(number, probe, sources, question),
    )
  ) {
    return "number";
  }
  if (!claimBackedByCited(probe, cited)) return "low_overlap";
  return null;
}

const ECHO_STOP = new Set([
  "la",
  "va",
  "cua",
  "voi",
  "cac",
  "mot",
  "nhung",
  "the",
  "nao",
  "gi",
  "toi",
  "ban",
  "khi",
  "lam",
  "de",
  "co",
  "trong",
  "nay",
  "do",
  "duoc",
  "nhu",
  "tren",
  "and",
  "for",
  "with",
  "this",
  "that",
  "you",
  "your",
  "how",
  "what",
  "from",
]);

/** Short words count. "Đi bộ sáng" is an echo even though each word is under 4 letters. */
function echoTokens(text: string): string[] {
  return [
    ...new Set(
      foldVietnamese(text)
        .replace(/\[s\d+\]/gi, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !ECHO_STOP.has(token)),
    ),
  ];
}

/** Jaccard or containment with the question. A snippet fact the question never used is a claim. */
function echoesQuestion(
  sentence: string,
  question: string,
  sources: Array<{ title: string; snippet: string }> = [],
): boolean {
  const sentenceTokens = echoTokens(sentence);
  const questionTokens = new Set(echoTokens(question));
  if (sentenceTokens.length < 2 || questionTokens.size === 0) return false;
  const intersection = sentenceTokens.filter((token) => questionTokens.has(token));
  const union = new Set([...sentenceTokens, ...questionTokens]).size;
  const jaccard = union === 0 ? 0 : intersection.length / union;
  const containment = intersection.length / sentenceTokens.length;
  if (jaccard < 0.6 && containment < 0.8) return false;
  const snippetTokens = new Set(
    echoTokens(sources.map((source) => `${source.title} ${source.snippet}`).join(" ")),
  );
  const novelClaim = sentenceTokens.some(
    (token) => !questionTokens.has(token) && snippetTokens.has(token),
  );
  return !novelClaim;
}

function stripUnclosedBold(text: string): string {
  const marks = text.match(/\*\*/g);
  if (!marks || marks.length % 2 === 0) return text;
  return text.replace(/\*\*/g, "");
}

function isHeaderLine(line: string): boolean {
  const bare = line.replace(/(\s*\[S\d+\])+\s*$/gi, "").trim();
  if (!bare) return false;
  if (/^#{1,6}\s+/.test(bare)) return true;
  if (/^\*\*[^*]+\*\*$/.test(bare)) return true;
  const folded = foldVietnamese(bare);
  if (/^(?:nguon|sources?|references?|citations?)\s*:/.test(folded)) return true;
  return false;
}

/** Drop a leading bold or heading line before the advice is grounded. */
function peelHeader(text: string): { body: string; droppedHeader: boolean } {
  const kept: string[] = [];
  let droppedHeader = false;
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isHeaderLine(trimmed)) {
      droppedHeader = true;
      continue;
    }
    kept.push(trimmed);
  }
  let body = kept.join(" ").trim();
  const peeled = body.replace(/^(?:\s*\*\*[^*]+\*\*\s*)+/, "").trim();
  if (peeled !== body) droppedHeader = true;
  body = peeled.replace(/^\s*#{1,6}\s+[^\n.]+\s*/, "").trim();
  return { body, droppedHeader };
}

function isIssuerOnly(text: string): boolean {
  const folded = foldVietnamese(text)
    .replace(/\[s\d+\]/gi, " ")
    .replace(/[.*]+/g, " ");
  const words = folded.split(/[^a-z0-9]+/).filter((word) => word.length >= 2);
  if (words.length === 0) return false;
  const issuer = new Set([
    "bo",
    "y",
    "te",
    "viet",
    "nam",
    "to",
    "chuc",
    "gioi",
    "who",
    "bao",
    "hiem",
    "xa",
    "hoi",
    "ngan",
    "hang",
    "nha",
    "nuoc",
    "cdc",
    "theo",
    "cua",
    "la",
    "nguon",
  ]);
  return words.every((word) => issuer.has(word));
}

function nonAnswerReason(
  sentence: string,
  question: string,
  sources: Array<{ title: string; snippet: string }> = [],
): SentenceDropReason | null {
  const stripped = sentence.replace(/\[S\d+\]/gi, " ").trim();
  const folded = foldVietnamese(stripped);
  if (
    /(?:^|[^a-z])(?:duoi day|sau day|toi se tra loi|cau tra loi|minh se giai thich|xin tra loi|de tra loi|ve cau hoi|tom lai|here is|i will answer|let me|to answer)/.test(
      folded,
    )
  ) {
    return "meta";
  }
  if (isHeaderLine(stripped)) return "header";
  if (isIssuerOnly(stripped)) return "issuer_tag";
  if (/\?\s*$/.test(stripped)) return "rhetorical";
  if (echoesQuestion(sentence, question, sources)) return "echo";
  return null;
}

export function answerEchoesQuestion(
  answer: string,
  question: string,
  sources: Array<{ title: string; snippet: string }> = [],
): boolean {
  return answerSentences(answer).some((sentence) =>
    echoesQuestion(sentence, question, sources),
  );
}

function answerHasCutUrl(answer: string): boolean {
  const urls = answer.match(/https?:\/\/[^\s)>\]]+/gi) ?? [];
  return urls.some((raw) => completeHttpUrl(raw) == null);
}

function isDanglingFragment(text: string): boolean {
  const folded = foldVietnamese(text.replace(/\[S\d+\]/gi, " ").replace(/[.…]+/g, " "));
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean);
  const lead = new Set(["xem", "them", "tai", "theo", "doc", "more", "read", "at", "link"]);
  if (words.length > 0 && words.every((word) => lead.has(word) || word.length < 4)) return true;
  return contentTokens(text.replace(/\[S\d+\]/gi, " ")).length === 0;
}

function assessSentence(
  sentence: string,
  sources: SupportSource[],
  question: string,
): { text: string; reason: SentenceDropReason | null } {
  const trimmed = sentence.trim();
  if (!trimmed || JUNK_TEXT.test(trimmed)) return { text: "", reason: "junk" };
  const openedBold = stripUnclosedBold(trimmed);
  const peeled = peelHeader(openedBold);
  const opened = peeled.body;
  if (!opened) {
    return { text: "", reason: peeled.droppedHeader ? "header" : "junk" };
  }
  // A model phone instruction is removed. A factual 115 in a reading can stay.
  if (mentionsEmergencyNumber(opened)) return { text: "", reason: "model_115" };
  // Short care words ("bác sĩ") are not a citation-only line.
  if (postponesSeekingCare(opened)) {
    const remainder = positiveCareRemainder(opened);
    if (remainder && !postponesSeekingCare(remainder)) {
      return assessSentence(remainder, sources, question);
    }
    return { text: "", reason: "care_avoidance" };
  }
  if (isCitationOnly(opened)) {
    return { text: "", reason: peeled.droppedHeader ? "header" : "citation_only" };
  }
  const nonAnswer = nonAnswerReason(opened, question, sources);
  if (nonAnswer) return { text: "", reason: nonAnswer };
  if (isSourceRefusal(opened) && sources.length > 0) return { text: "", reason: "refusal" };
  if (/chưa tìm thấy đủ nguồn/.test(opened)) {
    const citedKeys = [...opened.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
    const cited = sources.filter((source) => citedKeys.includes(source.key));
    const pool = cited.length > 0 ? cited : sources;
    if (mentionsOutsideSource(opened, pool)) return { text: "", reason: "outside_source" };
    if (!medicationChangeIsSupported(opened, pool)) return { text: "", reason: "medication" };
    return { text: opened, reason: null };
  }
  const repaired = repairUrls(opened, sources);
  const working = collapseCitationMarkers(repaired.text);
  if (!working || isCitationOnly(working) || (repaired.droppedUrl && isDanglingFragment(working))) {
    return {
      text: "",
      reason: repaired.droppedUrl ? "truncated_url" : "citation_only",
    };
  }
  if (/\[S\d+\]/.test(working)) {
    const reason = supportFailure(working, sources, question);
    return reason ? { text: "", reason } : { text: working, reason: null };
  }
  let best: { key: string; ratio: number } | null = null;
  let fallback: SentenceDropReason = "uncited";
  for (const source of sources) {
    const ratio = overlapRatio(working, [source]);
    if (ratio < PARAPHRASE_OVERLAP) {
      fallback = "low_overlap";
      continue;
    }
    const probe = `${working} [${source.key}]`;
    const reason = supportFailure(probe, sources, question);
    if (reason) {
      fallback = reason;
      continue;
    }
    if (!best || ratio > best.ratio) best = { key: source.key, ratio };
  }
  if (!best) return { text: "", reason: fallback };
  return { text: `${normalizeSpace(working)} [${best.key}]`, reason: null };
}

/** Why a model sentence was dropped, or null when it is shown. */
export function sentenceDropReason(
  sentence: string,
  sources: SupportSource[],
  question: string,
): SentenceDropReason | null {
  return assessSentence(sentence, sources, question).reason;
}

/** Keep a cited claim or a paraphrase of the snippet. Drop every model 115 sentence. */
export function groundedSentence(
  sentence: string,
  sources: SupportSource[],
  question: string,
): string {
  return assessSentence(sentence, sources, question).text;
}

export function sentenceIsSupported(
  sentence: string,
  sources: SupportSource[],
  question: string,
): boolean {
  if (isAffirmativeSafetyTemplate(sentence, sources)) return true;
  if (postponesSeekingCare(sentence)) return false;
  if (mentionsEmergencyNumber(sentence)) return false;
  if (nonAnswerReason(sentence, question, sources)) return false;
  const grounded = groundedSentence(sentence, sources, question);
  if (!grounded || isCitationOnly(grounded)) return false;
  return normalizeSpace(grounded) === normalizeSpace(sentence);
}

/** Drop unsupported sentences. Model 115 sentences are removed. */
export function supportedAnswerText(
  answer: string,
  sources: SupportSource[],
  question: string,
): string {
  return answerSentences(answer)
    .map((sentence) => groundedSentence(sentence, sources, question))
    .filter((sentence) => sentence && !isCitationOnly(sentence))
    .join(" ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Every sentence must be supported, including numbers that name no organisation. */
export function answerAttributionsMatchSources(
  answer: string,
  sources: Array<{
    key: string;
    issuer: string;
    title: string;
    snippet: string;
    publicationDate?: string;
  }>,
  question = "",
): boolean {
  return answerSentences(answer).every((sentence) =>
    sentenceIsSupported(sentence, sources, question),
  );
}

export function citedAnswerMatchesQuestion(
  question: string,
  answer: string,
  sources: Array<{ key: string; title: string; snippet: string; score?: number }>,
): boolean {
  const used = [...answer.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
  const cited = sources.filter((source) => used.includes(source.key));
  if (cited.length === 0) return false;
  if (cited.some((source) => (source.score ?? 1) < MIN_RETRIEVAL_SCORE)) return false;
  return cited.every((source) => sourceMatchesQuestionTopic(question, source));
}

/** Only cache / replay answers that cite official sources. */
export function isGroundedOfficialAnswer(payload: {
  answer: string;
  sources: CachedSource[];
}): boolean {
  if (!answerHasCitations(payload.answer)) return false;
  if (!payload.sources.length) return false;
  const officialCount = payload.sources.filter((s) =>
    sourceLooksOfficial({
      issuer: s.issuer,
      trustTier: s.trustTier,
      url: s.url,
    }),
  ).length;
  if (officialCount === 0) return false;
  // Every cited source in the payload should look official
  return officialCount === payload.sources.length;
}

export function sourceUrlOk(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return !isGenericHomepageUrl(url);
}

/** True when every cited source is on the question's topic and has a real document URL. */
export function cachedSourcesMatchQuestion(
  question: string,
  answer: string,
  sources: CachedSource[],
  mode: CachedAnswer["mode"] = "kv_cache",
): boolean {
  void mode;
  if (!sources.every((source) => sourceUrlOk(source.url))) return false;
  if (!citedAnswerMatchesQuestion(question, answer, sources)) return false;
  // Bank and generated answers both have to be fully grounded. A dropped
  // sentence or an off-topic citation must not be stored.
  return answerAttributionsMatchSources(answer, sources, question);
}

export async function readAnswerCache(
  env: Env,
  question: string,
): Promise<CachedAnswer | null> {
  if (!env.CONFIG) return null;
  try {
    const raw = await env.CONFIG.get(cacheKeyForQuestion(question));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAnswer;
    if (!parsed?.answer || !Array.isArray(parsed.sources)) return null;
    if (!isGroundedOfficialAnswer(parsed)) return null;
    if (answerHasModelEmergency(parsed.answer)) return null;
    if (answerPostponesCare(parsed.answer)) return null;
    if (answerHasCutUrl(parsed.answer)) return null;
    if (answerEchoesQuestion(parsed.answer, question, parsed.sources)) return null;
    const mode = parsed.mode === "answer_bank" ? "answer_bank" : "kv_cache";
    if (!cachedSourcesMatchQuestion(question, parsed.answer, parsed.sources, mode))
      return null;
    return { ...parsed, mode: "kv_cache" };
  } catch {
    return null;
  }
}

export async function writeAnswerCache(
  env: Env,
  question: string,
  payload: Omit<CachedAnswer, "mode" | "cachedAt"> & {
    mode?: CachedAnswer["mode"];
  },
): Promise<void> {
  if (!env.CONFIG) return;
  if (!payload.answer || payload.answer.length < 80) return;
  if (payload.answer.includes("chưa tìm thấy đủ nguồn")) return;
  if (!isGroundedOfficialAnswer(payload)) return;
  if (answerHasModelEmergency(payload.answer)) return;
  if (answerPostponesCare(payload.answer)) return;
  if (answerHasCutUrl(payload.answer)) return;
  if (answerEchoesQuestion(payload.answer, question, payload.sources)) return;
  if (answerHasInvalidCitations(payload.answer, payload.sources)) return;
  if (
    !cachedSourcesMatchQuestion(
      question,
      payload.answer,
      payload.sources,
      payload.mode ?? "kv_cache",
    )
  ) {
    return;
  }

  const body: CachedAnswer = {
    entryId: payload.entryId,
    classification: payload.classification,
    answer: payload.answer,
    sources: payload.sources,
    mode: payload.mode ?? "kv_cache",
    cachedAt: new Date().toISOString(),
  };

  try {
    await env.CONFIG.put(cacheKeyForQuestion(question), JSON.stringify(body), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch {
    /* optional binding / quota */
  }
}

/** Resolve prepared answer: curated bank first, then KV cache. */
export async function resolvePreparedAnswer(
  env: Env,
  question: string,
): Promise<CachedAnswer | null> {
  const bank = matchAnswerBank(question);
  if (bank) {
    const cached = bankEntryToCached(bank);
    if (!isGroundedOfficialAnswer(cached)) return null;
    void writeAnswerCache(env, question, cached);
    void writeAnswerCache(env, bank.question, cached);
    return cached;
  }
  return readAnswerCache(env, question);
}
