import { ANSWER_BANK, type AnswerBankEntry } from "@shared/content/answer-bank";
import { isGenericHomepageUrl } from "@shared/content/official-sources";
import { foldVietnamese } from "@shared/utils/vietnamese";
import {
  containsToken,
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
  const parts = answer
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
  return merged;
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

/**
 * Negation and hedges. A safety clause has to be an affirmative call to 115.
 * Short words and "không" are included on purpose: stripping "gọi 115" used to
 * leave only those and the clause was treated as pure safety.
 */
function hasHedge(folded: string): boolean {
  const plain = folded.replace(/['’]/g, "");
  return (
    /\b(khong|chang|chua|dung|khoi|unless|dont|not)\b/.test(plain) ||
    /\bno need\b/.test(plain) ||
    /\bnot necessary\b/.test(plain)
  );
}

/** Words that can sit in "Hãy gọi ngay 115" without adding a claim. */
const SAFETY_FUNCTION = new Set(["hay", "vui", "long", "xin", "ban", "nhe", "nha"]);

/** The 115 instruction, with no other claim and no hedge in the same clause. */
function isSafetyOnlyClause(clause: string): boolean {
  const folded = foldVietnamese(clause).replace(/\[s\d+\]/g, " ");
  const has115 = /goi\s+(?:ngay\s+)?115/.test(folded);
  const preamble = /neu co dau hieu nguy hiem/.test(folded);
  if (!has115 && !preamble) return false;
  if (hasHedge(folded)) return false;
  const stripped = folded
    .replace(/goi\s+(?:ngay\s+)?115/g, " ")
    .replace(/neu co dau hieu nguy hiem/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  const tokens = stripped
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 3 && !GENERIC_CLAIM.has(token) && !SAFETY_FUNCTION.has(token),
    );
  return tokens.length === 0;
}

function splitClaimsAndSafety(sentence: string): string[] {
  if (!/gọi\s+(?:ngay\s+)?115/i.test(sentence)) return [sentence];
  const parts = sentence
    .split(/(?<!\d)\s*[,;]\s*(?!\d)|\s+(?:và|nhưng)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [sentence];
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
  return hits.length / tokens.length >= 0.5;
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
    const clean = url.replace(/[.,]+$/g, "");
    if (!blob.includes(clean)) return true;
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

function citationsIn(text: string): string {
  const keys = [...text.matchAll(/\[(S\d+)\]/g)].map((match) => `[${match[1] ?? ""}]`);
  return [...new Set(keys)].join("");
}

function clauseIsSupported(
  clause: string,
  sentence: string,
  sources: SupportSource[],
  question: string,
): boolean {
  if (JUNK_TEXT.test(clause) || isCitationOnly(clause)) return false;
  const probe = /\[S\d+\]/.test(clause)
    ? clause
    : `${clause} ${citationsIn(sentence)}`.trim();
  if (answerHasInvalidCitations(probe, sources)) return false;
  const citedKeys = [...probe.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
  const cited = sources.filter((source) => citedKeys.includes(source.key));
  if (cited.length === 0) return false;
  if (mentionsOutsideSource(probe, cited)) return false;
  if (!medicationChangeIsSupported(probe, cited)) return false;
  if (
    !claimNumbers(probe).every((number) =>
      numberIsSupported(number, probe, sources, question),
    )
  ) {
    return false;
  }
  return claimBackedByCited(probe, cited);
}

/**
 * Keep a cited claim and a bare 115 clause. Drop everything else in the sentence,
 * including a 115 sentence that also carries an unsupported claim.
 */
export function groundedSentence(
  sentence: string,
  sources: SupportSource[],
  question: string,
): string {
  const trimmed = sentence.trim();
  if (!trimmed || JUNK_TEXT.test(trimmed)) return "";
  // A refusal is not an answer when a snippet was already retrieved.
  if (isSourceRefusal(trimmed) && sources.length > 0) return "";
  if (/chưa tìm thấy đủ nguồn/.test(trimmed)) {
    const citedKeys = [...trimmed.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
    const cited = sources.filter((source) => citedKeys.includes(source.key));
    const pool = cited.length > 0 ? cited : sources;
    if (mentionsOutsideSource(trimmed, pool)) return "";
    if (!medicationChangeIsSupported(trimmed, pool)) return "";
    return trimmed;
  }
  const parts = splitClaimsAndSafety(trimmed);
  const kept = parts.filter((part) => {
    if (!isSafetyOnlyClause(part))
      return clauseIsSupported(part, trimmed, sources, question);
    const citedKeys = [...trimmed.matchAll(/\[(S\d+)\]/g)].map((match) => match[1] ?? "");
    const cited = sources.filter((source) => citedKeys.includes(source.key));
    return !mentionsOutsideSource(part, cited);
  });
  if (kept.length === 0) return "";
  if (kept.length === parts.length) return trimmed;
  if (kept.every((part) => isSafetyOnlyClause(part))) {
    return normalizeSpace(kept.join(", ").replace(/\[S\d+\]/g, " "));
  }
  const body = normalizeSpace(
    kept
      .map((part) => part.replace(/\[S\d+\]/g, " "))
      .join(", ")
      .replace(/\s+([,.;])/g, "$1"),
  );
  const markers = citationsIn(trimmed);
  const grounded = markers ? `${body} ${markers}` : body;
  return isCitationOnly(grounded) ? "" : grounded;
}

export function sentenceIsSupported(
  sentence: string,
  sources: SupportSource[],
  question: string,
): boolean {
  const grounded = groundedSentence(sentence, sources, question);
  if (!grounded || isCitationOnly(grounded)) return false;
  return normalizeSpace(grounded) === normalizeSpace(sentence);
}

/** Drop unsupported sentences. A 115 clause stays; other claims in that sentence do not. */
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
