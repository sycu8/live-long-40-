import {
  ACUTE_CLASSIFIER_SYSTEM_PROMPT,
  ACUTE_VERIFIER_SYSTEM_PROMPT,
} from "@shared/rules/acute-classifier-prompt";
import { normalizeSafetyText, type RiskClass } from "@shared/rules/safety";
import type { Env } from "../env";
import { WORKERS_AI_TEXT_MODEL } from "./models";
import { readWorkersAiText, runWorkersAi } from "./run";

/** One call. A retry did not recover timed-out verdicts. */
export const ACUTE_CLASSIFIER_TIMEOUT_MS = 3_500;
export const ACUTE_CLASSIFIER_MAX_TOKENS = 180;
/** Short on purpose. The key is a hash, and the value is only the verdict. */
export const ACUTE_CLASSIFIER_CACHE_TTL_SECONDS = 15 * 60;

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
  "burn",
  "self_harm",
] as const;

export type AcuteCategory = (typeof ACUTE_CATEGORIES)[number];

export type AcuteVerdict = {
  category: AcuteCategory;
  acute: boolean;
  intent_first_person: boolean;
  figurative: boolean;
};

export type AcuteFailReason =
  "timeout" | "parse" | "empty" | "unavailable" | "unsupported";

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
  burn: "burn",
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

function coerceBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}

/** First balanced object. Fences and a short preface are ignored. */
function extractJsonObject(raw: string): string | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * One object with the four required keys. Boolean strings are accepted.
 * Extra keys and unknown categories are rejected.
 */
export function parseAcuteClassifierOutput(raw: string): AcuteVerdict | null {
  const body = extractJsonObject(raw);
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
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
  const acute = coerceBool(record.acute);
  const intent = coerceBool(record.intent_first_person);
  const figurative = coerceBool(record.figurative);
  if (acute === null || intent === null || figurative === null) return null;
  return {
    category: record.category as AcuteCategory,
    acute,
    intent_first_person: intent,
    figurative,
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

/** Hash only. The question text is not part of the key or the stored value. */
export async function acuteClassifierCacheKey(normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`acute-clf:v2:${normalized}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `acute_clf:v2:${hex}`;
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
      expirationTtl: ACUTE_CLASSIFIER_CACHE_TTL_SECONDS,
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

type ModelRead = { raw: string } | { fail: AcuteFailReason };

/** 5025 means this model has no JSON mode. Retrying the same call will fail again. */
function isUnsupportedModelOutput(message: string): boolean {
  return /5025|json schema|json mode/i.test(message);
}

async function readModel(
  env: Env,
  question: string,
  timeoutMs: number,
): Promise<ModelRead> {
  if (timeoutMs <= 0) return { fail: "timeout" };
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
          temperature: 0,
        },
        { signal: abort.signal },
      ),
      timeoutMs,
      abort,
    );
    const read = readWorkersAiText(response);
    if (!read.ok) {
      if (isUnsupportedModelOutput(read.error)) return { fail: "unsupported" };
      return { fail: "empty" };
    }
    if (!read.text.trim()) return { fail: "empty" };
    return { raw: read.text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (isUnsupportedModelOutput(message)) return { fail: "unsupported" };
    if (abort.signal.aborted || message === "acute_classifier_timeout") {
      return { fail: "timeout" };
    }
    return { fail: "empty" };
  }
}

export async function classifyAcuteRisk(
  env: Env,
  question: string,
  options?: { timeoutMs?: number },
): Promise<AcuteLayerResult> {
  const normalized = normalizeSafetyText(question);
  if (!normalized) return { status: "fail", reason: "empty" };

  if (!env.AI) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "acute_classifier_unavailable",
        reason: "binding_missing",
      }),
    );
    return { status: "fail", reason: "unavailable" };
  }

  const key = await acuteClassifierCacheKey(normalized);
  const cached = await readCache(env, key);
  if (cached) return { status: "ok", verdict: cached, cached: true };

  const timeoutMs = Math.min(
    ACUTE_CLASSIFIER_TIMEOUT_MS,
    options?.timeoutMs ?? ACUTE_CLASSIFIER_TIMEOUT_MS,
  );
  const first = await readModel(env, question, timeoutMs);
  if ("fail" in first) return { status: "fail", reason: first.fail };
  const parsed = parseAcuteClassifierOutput(first.raw);
  if (!parsed) return { status: "fail", reason: "parse" };
  await writeCache(env, key, parsed);
  return { status: "ok", verdict: parsed, cached: false };
}

/** One short call. A failure is not a clean rejection. */
export const ACUTE_VERIFIER_TIMEOUT_MS = 2_000;

/** True confirms a crisis. False is a clean idiom. "failed" is timeout, error, or bad output. */
export type VerifierAnswer = boolean | "failed";

/** True only when the verifier returns crisis=true. Anything else is false. */
export function parseCrisisVerifierOutput(raw: string): boolean | null {
  const body = extractJsonObject(raw);
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "crisis")) return null;
  return coerceBool(record.crisis);
}

export async function verifyCrisisWording(
  env: Env,
  question: string,
  options?: { timeoutMs?: number },
): Promise<VerifierAnswer> {
  if (!env.AI) return "failed";
  const timeoutMs = Math.min(
    ACUTE_VERIFIER_TIMEOUT_MS,
    options?.timeoutMs ?? ACUTE_VERIFIER_TIMEOUT_MS,
  );
  const abort = new AbortController();
  try {
    const response = await withTimeout(
      runWorkersAi(
        env,
        WORKERS_AI_TEXT_MODEL,
        {
          messages: [
            { role: "system", content: ACUTE_VERIFIER_SYSTEM_PROMPT },
            { role: "user", content: question },
          ],
          stream: false,
          max_tokens: 40,
          temperature: 0,
        },
        { signal: abort.signal },
      ),
      timeoutMs,
      abort,
    );
    const read = readWorkersAiText(response);
    if (!read.ok || !read.text.trim()) return "failed";
    const parsed = parseCrisisVerifierOutput(read.text);
    if (parsed === true) return true;
    if (parsed === false) return false;
    return "failed";
  } catch {
    return "failed";
  }
}
