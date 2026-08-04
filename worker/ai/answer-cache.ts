import { ANSWER_BANK, type AnswerBankEntry } from "@shared/content/answer-bank";
import { foldVietnamese } from "@shared/utils/vietnamese";
import type { QuestionClassification } from "@shared/constants/product";
import type { Env } from "../env";

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
};

export type CachedAnswer = {
  entryId?: string;
  classification: QuestionClassification;
  answer: string;
  sources: CachedSource[];
  mode: "answer_bank" | "kv_cache";
  cachedAt: string;
};

const CACHE_PREFIX = "ans_cache:v1:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 45; // ~45 days

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function cacheKeyForQuestion(question: string): string {
  const folded = foldVietnamese(question).replace(/\s+/g, " ").trim();
  return `${CACHE_PREFIX}${djb2(folded)}_${folded.slice(0, 48).replace(/\s+/g, "_")}`;
}

function aliasScore(foldedQuery: string, alias: string): number {
  const a = alias.trim();
  if (!a) return 0;
  if (foldedQuery === a) return 1;
  if (foldedQuery.includes(a) || a.includes(foldedQuery)) {
    // Longer overlap wins
    const shorter = Math.min(foldedQuery.length, a.length);
    const longer = Math.max(foldedQuery.length, a.length);
    return 0.72 + (shorter / longer) * 0.2;
  }
  // Token overlap
  const qTokens = new Set(foldedQuery.split(/\s+/).filter((t) => t.length >= 2));
  const aTokens = a.split(/\s+/).filter((t) => t.length >= 2);
  if (aTokens.length === 0) return 0;
  let hits = 0;
  for (const t of aTokens) {
    if (qTokens.has(t)) hits += 1;
  }
  const ratio = hits / aTokens.length;
  return ratio >= 0.7 ? 0.55 + ratio * 0.2 : 0;
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
    snippet: s.snippet,
    score: 1,
    status: "active",
    sourceId: `bank:${entry.id}:${i + 1}`,
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
    // Warm KV so paraphrases that hash nearby still benefit after first hit
    void writeAnswerCache(env, question, cached);
    void writeAnswerCache(env, bank.question, cached);
    return cached;
  }
  return readAnswerCache(env, question);
}
