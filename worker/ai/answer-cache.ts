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
  isCompleteHttpUrl,
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

// v5 does not read v4. #44 and the previous grounding build both wrote v4,
// including off-topic answers. Those keys are left in KV until their TTL.
const CACHE_PREFIX = "ans_cache:v5:";
/** New writes expire in 7 days. Older v5 values keep whatever TTL they were given. */
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

function answerSentences(answer: string): string[] {
  const urls: string[] = [];
  const masked = answer.replace(/https?:\/\/[^\s)>\]]+/gi, (url) => {
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
    part.replace(/URL(\d+)TOKEN/g, (_, index: string) => urls[Number(index)] ?? ""),
  );
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
  | "uncited";

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

/** Any 115 in model text. The system appends its own line after filtering. */
export function mentionsEmergencyNumber(text: string): boolean {
  return /(?:^|[^\d])115(?:[^\d]|$)/.test(text);
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
  const hits = tokens.filter((token) => containsToken(haystack, token));
  return hits.length / tokens.length >= PARAPHRASE_OVERLAP;
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
    if (!blob.includes(clean)) return true;
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
    const url = raw.replace(/[.,;:!?)]+$/g, "");
    const cut =
      !isCompleteHttpUrl(url) ||
      known.some((source) => source.length > url.length && source.startsWith(url));
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

function assessSentence(
  sentence: string,
  sources: SupportSource[],
  question: string,
): { text: string; reason: SentenceDropReason | null } {
  const trimmed = sentence.trim();
  if (!trimmed || JUNK_TEXT.test(trimmed)) return { text: "", reason: "junk" };
  // The model does not get to write 115. The system line is appended later.
  if (mentionsEmergencyNumber(trimmed)) return { text: "", reason: "model_115" };
  if (isSourceRefusal(trimmed) && sources.length > 0) return { text: "", reason: "refusal" };
  if (/chưa tìm thấy đủ nguồn/.test(trimmed)) {
    const citedKeys = [...trimmed.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
    const cited = sources.filter((source) => citedKeys.includes(source.key));
    const pool = cited.length > 0 ? cited : sources;
    if (mentionsOutsideSource(trimmed, pool)) return { text: "", reason: "outside_source" };
    if (!medicationChangeIsSupported(trimmed, pool)) return { text: "", reason: "medication" };
    return { text: trimmed, reason: null };
  }
  const repaired = repairUrls(trimmed, sources);
  const working = repaired.text;
  if (!working || isCitationOnly(working)) {
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
  if (mentionsEmergencyNumber(sentence)) return false;
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
