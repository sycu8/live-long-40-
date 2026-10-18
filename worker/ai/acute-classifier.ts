import { ACUTE_CLASSIFIER_SYSTEM_PROMPT } from "@shared/rules/acute-classifier-prompt";
import { normalizeSafetyText, type RiskClass } from "@shared/rules/safety";
import type { Env } from "../env";
import { WORKERS_AI_TEXT_MODEL } from "./models";
import { readWorkersAiText, runWorkersAi } from "./run";

export const ACUTE_CLASSIFIER_TIMEOUT_MS = 2_500;
export const ACUTE_CLASSIFIER_MAX_TOKENS = 180;
const CACHE_TTL_SECONDS = 60 * 60 * 6;

export const ACUTE_CATEGORIES = [
  "none",
  "stroke",
  "seizure",
  "chest",
  "breathing",
  "low_sugar",
  "allergy",
  "bleeding",
  "poisoning",
  "head_injury",
  "fall",
  "self_harm",
] as const;

export type AcuteCategory = (typeof ACUTE_CATEGORIES)[number];

export type AcuteVerdict = {
  category: AcuteCategory;
  acute: boolean;
  intent_first_person: boolean;
  figurative: boolean;
};

export type AcuteFailReason = "timeout" | "parse" | "empty" | "unavailable";

export type AcuteLayerResult =
  | { status: "ok"; verdict: AcuteVerdict; cached: boolean }
  | { status: "fail"; reason: AcuteFailReason };

const CATEGORY_SET = new Set<string>(ACUTE_CATEGORIES);
const VERDICT_KEYS = ["category", "acute", "intent_first_person", "figurative"] as const;

const CATEGORY_TO_RISK: Record<AcuteCategory, Exclude<RiskClass, "none"> | null> = {
  none: null,
  stroke: "stroke",
  seizure: "seizure",
  chest: "chest_pain",
  breathing: "breathing",
  low_sugar: "low_blood_sugar",
  allergy: "severe_allergy",
  bleeding: "bleeding",
  poisoning: "poisoning",
  head_injury: "head_injury",
  fall: "fall_emergency",
  self_harm: "self_harm",
};

const CACHE_LIMIT = 200;
const memoryCache = new Map<string, AcuteVerdict>();

function remember(key: string, verdict: AcuteVerdict): void {
  if (memoryCache.size >= CACHE_LIMIT && !memoryCache.has(key)) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, verdict);
}

export function clearAcuteClassifierCache(): void {
  memoryCache.clear();
}

export function isAcuteClassifierInput(inputs: unknown): boolean {
  if (!inputs || typeof inputs !== "object") return false;
  const messages = (inputs as { messages?: Array<{ content?: unknown }> }).messages;
  const content = messages?.[0]?.content;
  return typeof content === "string" && content.includes("ACUTE_RISK_JSON");
}

/** Strict schema. Strings "true"/"false" and extra keys are rejected. */
export function parseAcuteClassifierOutput(raw: string): AcuteVerdict | null {
  const text = raw.trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== VERDICT_KEYS.length) return null;
  for (const key of VERDICT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
  }
  if (typeof record.category !== "string" || !CATEGORY_SET.has(record.category))
    return null;
  if (typeof record.acute !== "boolean") return null;
  if (typeof record.intent_first_person !== "boolean") return null;
  if (typeof record.figurative !== "boolean") return null;
  return {
    category: record.category as AcuteCategory,
    acute: record.acute,
    intent_first_person: record.intent_first_person,
    figurative: record.figurative,
  };
}

/** Alert only when the classifier says the event is acute. Self-harm also needs intent and a literal reading. */
export function riskFromAcuteVerdict(
  verdict: AcuteVerdict,
): Exclude<RiskClass, "none"> | null {
  if (!verdict.acute || verdict.category === "none") return null;
  if (verdict.category === "self_harm") {
    if (!verdict.intent_first_person || verdict.figurative) return null;
  }
  return CATEGORY_TO_RISK[verdict.category];
}

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cacheKey(normalized: string): string {
  return `acute_clf:v1:${djb2(normalized)}:${normalized.slice(0, 180)}`;
}

async function readCache(env: Env, key: string): Promise<AcuteVerdict | null> {
  const local = memoryCache.get(key);
  if (local) return local;
  if (!env.CONFIG) return null;
  try {
    const raw = await env.CONFIG.get(key);
    if (!raw) return null;
    const verdict = parseAcuteClassifierOutput(raw);
    if (!verdict) return null;
    remember(key, verdict);
    return verdict;
  } catch {
    return null;
  }
}

async function writeCache(env: Env, key: string, verdict: AcuteVerdict): Promise<void> {
  remember(key, verdict);
  if (!env.CONFIG) return;
  try {
    await env.CONFIG.put(key, JSON.stringify(verdict), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch {
    // A cache miss next time is safe. The classifier can run again.
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abort: AbortController,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  void promise.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("acute_classifier_timeout");
      if (!abort.signal.aborted) abort.abort(err);
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export async function classifyAcuteRisk(
  env: Env,
  question: string,
  options?: { timeoutMs?: number },
): Promise<AcuteLayerResult> {
  const normalized = normalizeSafetyText(question);
  if (!normalized) return { status: "fail", reason: "empty" };
  const key = cacheKey(normalized);
  const cached = await readCache(env, key);
  if (cached) return { status: "ok", verdict: cached, cached: true };

  if (!env.AI) return { status: "fail", reason: "unavailable" };

  const timeoutMs = Math.min(
    ACUTE_CLASSIFIER_TIMEOUT_MS,
    options?.timeoutMs ?? ACUTE_CLASSIFIER_TIMEOUT_MS,
  );
  const abort = new AbortController();
  try {
    const response = await withTimeout(
      runWorkersAi(
        env,
        WORKERS_AI_TEXT_MODEL,
        {
          messages: [
            { role: "system", content: ACUTE_CLASSIFIER_SYSTEM_PROMPT },
            { role: "user", content: question },
          ],
          stream: false,
          max_tokens: ACUTE_CLASSIFIER_MAX_TOKENS,
        },
        { signal: abort.signal },
      ),
      timeoutMs,
      abort,
    );
    const read = readWorkersAiText(response);
    if (!read.ok || !read.text.trim()) return { status: "fail", reason: "empty" };
    const verdict = parseAcuteClassifierOutput(read.text);
    if (!verdict) return { status: "fail", reason: "parse" };
    await writeCache(env, key, verdict);
    return { status: "ok", verdict, cached: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (abort.signal.aborted || message === "acute_classifier_timeout") {
      return { status: "fail", reason: "timeout" };
    }
    return { status: "fail", reason: "empty" };
  }
}
