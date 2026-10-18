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
  hostMatchesCited,
  httpHostname,
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

// v9 does not read v8. Care-downgrade answers stored under v8 stay until TTL.
const CACHE_PREFIX = "ans_cache:v9:";
/** New writes expire in 7 days. Older keys are never read. */
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
 * Care, as a sentence-level class. A comma does not split this decision.
 * The property test crosses these with every operator token.
 */
export const CARE_TERMS = [
  "hospital",
  "doctor",
  "physician",
  "clinic",
  "kham",
  "di vien",
  "bac si",
  "cap cuu",
  "115",
  "care",
  "exam",
  "checkup",
  "checked",
  "emergency",
  "emergency room",
  "ambulance",
  "er",
  "benh vien",
  "nhap vien",
  "admission",
  "phong kham",
  "xe cap cuu",
  "co so y te",
  "health facility",
  "thuoc",
  "medicine",
  "medicines",
  "drug",
  "drugs",
  "antibiotic",
  "antibiotics",
  "khang sinh",
  "tu dieu chinh",
  "self adjust",
  "tro giup",
  "kiem tra",
  "medical help",
] as const;

/**
 * Negators. "shouldn't" / "isn't" / "doesn't" / "needn't" are one token
 * after the apostrophe is removed. A modal does not cancel one of these.
 */
export const NEGATOR_TOKENS = [
  "khong",
  "chua",
  "chang",
  "dung",
  "khoi",
  "not",
  "no",
  "never",
  "dont",
  "shouldnt",
  "isnt",
  "doesnt",
  "neednt",
  "without",
] as const;

/** Modals. A modal does not cancel a negator. */
export const MODAL_TOKENS = ["nen", "hay", "should", "can", "must", "ought"] as const;

/** Time and deferral. "put off" is detected beside these, not as its own sentence. */
export const TIME_TOKENS = [
  "mai",
  "ngay",
  "later",
  "tomorrow",
  "wait",
  "week",
  "day",
  "days",
  "postpone",
  "delay",
  "sau",
  "tuan",
  "doi",
  "cho",
] as const;

export const LIMITER_TOKENS = [
  "limit",
  "skip",
  "unnecessary",
  "han che",
  "gioi han",
  "bo qua",
] as const;

const CARE_PHRASE_SET = new Set<string>(CARE_TERMS.filter((term) => term.includes(" ")));
const CARE_WORDS = new Set<string>(CARE_TERMS.filter((term) => !term.includes(" ")));
const NEGATOR_SET = new Set<string>(NEGATOR_TOKENS);
const MODAL_SET = new Set<string>(MODAL_TOKENS);
const TIME_SET = new Set<string>(TIME_TOKENS);
const LIMITER_WORDS = new Set<string>(LIMITER_TOKENS.filter((term) => !term.includes(" ")));
const LIMITER_PHRASE_SET = new Set<string>(LIMITER_TOKENS.filter((term) => term.includes(" ")));

function careAt(words: string[], index: number): boolean {
  const pair = `${words[index] ?? ""} ${words[index + 1] ?? ""}`;
  const triple = `${pair} ${words[index + 2] ?? ""}`;
  const quad = `${triple} ${words[index + 3] ?? ""}`;
  if (CARE_PHRASE_SET.has(quad) || CARE_PHRASE_SET.has(triple) || CARE_PHRASE_SET.has(pair)) {
    return true;
  }
  return CARE_WORDS.has(words[index] ?? "");
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
  if (word !== "dung" && NEGATOR_SET.has(word)) return true;
  if (word !== "dung") return false;
  if (words[index - 1] === "su" || words[index - 1] === "noi" || words[index - 1] === "ung")
    return false;
  if (words[index + 1] === "cu") return false;
  if (/đừng/i.test(clause)) return true;
  return !HAS_ACCENT.test(clause);
}

function hasCare(words: string[]): boolean {
  return words.some((_, index) => careAt(words, index));
}

/** Care is decided on the whole sentence. A comma does not open a new decision. */
export function isCareSentence(sentence: string): boolean {
  if (isSystemSafetyLine(sentence)) return false;
  return hasCare(clauseWords(sentence));
}

/**
 * Lower case, diacritics kept, chips and bold markers removed, whitespace collapsed.
 * This is the extractive comparison, not the folded operator scan.
 */
function extractiveNormalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\[s\d+\]/gi, " ")
    .replace(/\*\*/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractiveTokens(text: string): string[] {
  return extractiveNormalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function multisetOverlap(model: string[], source: string[]): number {
  if (model.length === 0 || source.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const token of source) counts.set(token, (counts.get(token) ?? 0) + 1);
  let hits = 0;
  for (const token of model) {
    const left = counts.get(token) ?? 0;
    if (left <= 0) continue;
    hits += 1;
    counts.set(token, left - 1);
  }
  return hits / Math.max(model.length, source.length);
}

/** Operator tokens in order, so an inserted copy of a token the source already has still counts. */
function operatorTokens(text: string): string[] {
  const words = clauseWords(text);
  const found: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? "";
    if (isNegator(words, i, text)) found.push(word === "dung" ? "dung" : word);
    if (MODAL_SET.has(word)) found.push(word);
    if (word === "doi" && words[i - 1] === "theo") {
      /* "theo dõi" is not "đợi". */
    } else if (TIME_SET.has(word)) {
      found.push(word);
    }
    if (word === "put" && words[i + 1] === "off") found.push("put off");
    if (LIMITER_WORDS.has(word)) found.push(word);
    const pair = `${word} ${words[i + 1] ?? ""}`;
    if (LIMITER_PHRASE_SET.has(pair)) found.push(pair);
  }
  return found;
}

/**
 * v1.9 operator rule, kept on top of the overlap test.
 * A negator, modal, time word, or limiter that the source sentence does not
 * already contain makes the care sentence non-extractive.
 */
function operatorsAdded(model: string, source: string): boolean {
  const counts = new Map<string, number>();
  for (const token of operatorTokens(source)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  for (const token of operatorTokens(model)) {
    const left = counts.get(token) ?? 0;
    if (left <= 0) return true;
    counts.set(token, left - 1);
  }
  return false;
}

type ExtractiveSource = { key?: string; title: string; snippet: string };

/**
 * A care sentence may be shown and cached only when it is one cited source
 * sentence: token overlap at least 0.9, and no added operator token.
 */
export function isExtractiveCareSentence(
  sentence: string,
  sources: ExtractiveSource[],
): boolean {
  if (!isCareSentence(sentence)) return false;
  const citedKeys = [...sentence.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
  const pool =
    citedKeys.length > 0
      ? sources.filter((source) => source.key && citedKeys.includes(source.key))
      : sources;
  const modelTokens = extractiveTokens(sentence);
  if (modelTokens.length === 0 || pool.length === 0) return false;
  for (const source of pool) {
    const blob = `${source.title}. ${source.snippet}`;
    for (const part of answerSentences(blob)) {
      const sourceTokens = extractiveTokens(part);
      if (multisetOverlap(modelTokens, sourceTokens) < 0.9) continue;
      if (operatorsAdded(sentence, part)) continue;
      return true;
    }
  }
  return false;
}

/**
 * Drop a care sentence that is not an extractive copy of a cited sentence.
 * The system 115 line is not a care sentence.
 */
export function postponesSeekingCare(
  sentence: string,
  sources: ExtractiveSource[] = [],
): boolean {
  if (!isCareSentence(sentence)) return false;
  return !isExtractiveCareSentence(sentence, sources);
}

/** Never cache a care sentence unless it is extractive against the cited sources. */
export function answerFailsCache(
  answer: string,
  sources: ExtractiveSource[] = [],
): boolean {
  return answerSentences(answer).some((sentence) => postponesSeekingCare(sentence, sources));
}

export function answerPostponesCare(
  answer: string,
  sources: ExtractiveSource[] = [],
): boolean {
  return answerFailsCache(answer, sources);
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
    const host = httpHostname(clean);
    const sameDocument = cited.some((source) => {
      if (!source.url || !host) return false;
      const citedHost = httpHostname(source.url);
      if (!citedHost || !hostMatchesCited(host, citedHost)) return false;
      try {
        const path = new URL(clean).pathname.replace(/\/$/, "");
        const citedPath = new URL(source.url).pathname.replace(/\/$/, "");
        return path === citedPath || path === "";
      } catch {
        return false;
      }
    });
    if (!blob.includes(clean) && !isHostOnlyUrl(clean) && !sameDocument) return true;
    if (isHostOnlyUrl(clean)) {
      if (!host) return true;
      const hostKnown = cited.some((source) => {
        const citedHost = source.url ? httpHostname(source.url) : null;
        return citedHost ? hostMatchesCited(host, citedHost) : blob.includes(host);
      });
      if (!hostKnown && !blob.includes(host)) return true;
      continue;
    }
    if (sameDocument) continue;
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

function citedHostnames(sources: Array<{ url?: string }>): string[] {
  return sources
    .map((source) => (source.url ? httpHostname(source.url) : null))
    .filter((host): host is string => Boolean(host));
}

function repairUrls(
  sentence: string,
  sources: SupportSource[],
): { text: string; droppedUrl: boolean } {
  let droppedUrl = false;
  const known = sources
    .map((source) => source.url)
    .filter((url): url is string => Boolean(url));
  const hosts = citedHostnames(sources);
  const text = sentence.replace(/https?:\/\/[^\s)>\]]+/gi, (raw) => {
    const url = completeHttpUrl(raw);
    const host = url ? httpHostname(url) : null;
    if (!url || !host || !hosts.some((cited) => hostMatchesCited(host, cited))) {
      droppedUrl = true;
      return "";
    }
    const truncatedPath =
      !isHostOnlyUrl(url) &&
      known.some((source) => source.length > url.length && source.startsWith(url));
    if (truncatedPath) {
      droppedUrl = true;
      return "";
    }
    return url;
  });
  const cleaned = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/(?:^|\s)(?:tại|at)\s+(?=\[S\d+\]|[.!?…]|$)/gi, " ")
    .replace(/\s+([.!?…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text: cleaned, droppedUrl };
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
  const withoutChip = line.replace(/(\s*\[S\d+\])+\s*$/gi, "").trim();
  if (!withoutChip) return false;
  if (/^#{1,6}\s+/.test(withoutChip)) return true;
  if (/^\*\*[^*]+\*\*:?\s*$/.test(withoutChip)) return true;
  if (/^\[[^\]]+\]\s*$/.test(withoutChip)) return true;
  if (/^[^:\n]{1,60}:\s*$/.test(withoutChip)) return true;
  const folded = foldVietnamese(withoutChip);
  if (/^(?:nguon|sources?|references?|citations?)\s*:/.test(folded)) return true;
  if (/^(?:cam on|xin cam on|thank you|thanks)\b/.test(folded)) return true;
  return false;
}

/** Allow-list of non-claim headers. Nothing else is peeled. */
const ALLOW_HEADERS = ["tóm tắt", "trả lời", "câu trả lời", "summary", "answer"];

const SCOPE_LABELS = [
  "không nên",
  "tránh",
  "do not",
  "avoid",
  "common mistake",
  "things to avoid",
  "sai lầm",
];

const ISSUER_TAIL =
  /(?:\s*[—–-]\s*|\s+)(?:tổ chức y tế thế giới(?:\s*\(who\))?|bộ y tế(?: việt nam)?|bảo hiểm xã hội(?: việt nam)?|ngân hàng nhà nước(?: việt nam)?|who|cdc)\.?\s*(?:\[S\d+\]\s*)*$/i;

function stripTrailingIssuer(text: string): string {
  return text.replace(ISSUER_TAIL, "").trim();
}

/** "First," / "Đầu tiên," only, and only as the lead-in. */
function stripOrdinalLeadIn(text: string): string {
  return text.replace(/^(?:first|đầu tiên)\s*,\s+/i, "").trim();
}

/** A closed [Theo …] tag stays. A stray unclosed "[" does not. */
function stripStrayLead(text: string): string {
  if (/^\s*\[[^\]\n]{1,40}\]/.test(text)) return text;
  return text.replace(/^\s*\[(?!S\d+\])/i, "");
}

function headerCore(line: string): string {
  return line
    .replace(/(\s*\[S\d+\])+\s*$/gi, "")
    .replace(/\*\*/g, "")
    .trim()
    .replace(/[:：]\s*$/, "")
    .trim()
    .toLowerCase();
}

function isAllowHeaderOnly(line: string): boolean {
  return ALLOW_HEADERS.includes(headerCore(line));
}

/** Peel an allow-list header only when it is the whole line or a "Header:" prefix. */
function peelAllowPrefix(line: string): string {
  if (isAllowHeaderOnly(line)) return "";
  const match =
    /^\s*(?:\*\*)?(câu trả lời|tóm tắt|trả lời|summary|answer)(?:\*\*)?\s*:\s*/i.exec(line);
  if (!match) return line;
  return line.slice(match[0].length).trim();
}

function isBareScopeLabel(line: string): boolean {
  const stripped = line
    .replace(/(\s*\[S\d+\])+\s*$/gi, "")
    .replace(/\*\*/g, "")
    .trim();
  if (!stripped || /https?:\/\//i.test(stripped)) return false;
  const core = stripped.replace(/[:：]\s*$/, "").trim();
  const folded = foldVietnamese(core);
  if (SCOPE_LABELS.some((label) => foldVietnamese(label) === folded)) return true;
  return /^[^:\n]{1,80}:\s*$/.test(stripped) && !ALLOW_HEADERS.includes(core.toLowerCase());
}

function normalizeScopeLabel(line: string): string {
  return line
    .replace(/(\s*\[S\d+\])+\s*$/gi, "")
    .replace(/\*\*/g, "")
    .trim()
    .replace(/[:：]\s*$/, "")
    .trim();
}

function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

export type ModelLineState = { label: string | null };

/**
 * One model line. Allow-list headers are removed. A scope label on its own
 * line binds to each following item. Other labels stay on their content.
 */
export function consumeModelLine(
  line: string,
  state: ModelLineState,
): { emit: string | null; label: string | null } {
  let trimmed = stripStrayLead(stripUnclosedBold(line.trim()));
  if (!trimmed) return { emit: null, label: state.label };
  if (isAllowHeaderOnly(trimmed)) return { emit: null, label: null };
  const peeled = peelAllowPrefix(trimmed);
  if (!peeled) return { emit: null, label: null };
  if (isBareScopeLabel(peeled)) {
    return { emit: null, label: normalizeScopeLabel(peeled) };
  }
  let body = stripOrdinalLeadIn(stripTrailingIssuer(peeled));
  if (!body) return { emit: null, label: state.label };
  if (state.label) body = `${state.label}: ${stripListMarker(body)}`;
  return { emit: body, label: state.label };
}

function prepareSentence(text: string): { body: string; droppedHeader: boolean } {
  const opened = stripStrayLead(stripUnclosedBold(text.trim()));
  const peeled = stripOrdinalLeadIn(stripTrailingIssuer(peelAllowPrefix(opened)));
  return {
    body: peeled,
    droppedHeader: peeled !== opened.trim() || isAllowHeaderOnly(opened),
  };
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

function answerHasCutUrl(answer: string, sources: Array<{ url?: string }> = []): boolean {
  const urls = answer.match(/https?:\/\/[^\s)>\]]+/gi) ?? [];
  if (urls.length === 0) return false;
  const hosts = citedHostnames(sources);
  return urls.some((raw) => {
    const url = completeHttpUrl(raw);
    const host = url ? httpHostname(url) : null;
    if (!url || !host) return true;
    return !hosts.some((cited) => hostMatchesCited(host, cited));
  });
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
  const peeled = prepareSentence(trimmed);
  const opened = peeled.body;
  if (!opened) {
    return { text: "", reason: peeled.droppedHeader ? "header" : "junk" };
  }
  // A model phone instruction is removed. A factual 115 in a reading can stay.
  if (mentionsEmergencyNumber(opened)) return { text: "", reason: "model_115" };
  // Care is shown only as an extractive copy of a cited sentence. Nothing else.
  if (isCareSentence(opened) && !isExtractiveCareSentence(opened, sources)) {
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
  if (postponesSeekingCare(sentence, sources)) return false;
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
  const state: ModelLineState = { label: null };
  const kept: string[] = [];
  for (const sentence of answerSentences(answer)) {
    const consumed = consumeModelLine(sentence, state);
    state.label = consumed.label;
    if (!consumed.emit) continue;
    const grounded = groundedSentence(consumed.emit, sources, question);
    if (grounded && !isCitationOnly(grounded)) kept.push(grounded);
  }
  return kept.join(" ").replace(/[ \t]{2,}/g, " ").trim();
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
    if (answerPostponesCare(parsed.answer, parsed.sources)) return null;
    if (answerHasCutUrl(parsed.answer, parsed.sources)) return null;
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
  if (answerPostponesCare(payload.answer, payload.sources)) return;
  if (answerHasCutUrl(payload.answer, payload.sources)) return;
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
