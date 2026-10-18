import type { Env } from "../env";
import { isRetiredWorkersAiModel, WORKERS_AI_TEXT_MODEL } from "./models";

/**
 * Workers AI inference calls the binding directly: `env.AI.run(model, inputs)`.
 * Do not pass `{ gateway }` — the `song-an-40` gateway is not configured and
 * returns error 2001 ("Please configure AI Gateway").
 */
export const WORKERS_AI_EMPTY_RESPONSE = "Workers AI returned an empty response";

export async function runWorkersAi(
  env: Env,
  model: string,
  inputs: Record<string, unknown> | null | undefined,
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  if (!env.AI) {
    throw new Error("Workers AI binding is unavailable");
  }
  if (isRetiredWorkersAiModel(model)) {
    throw new Error(
      `Workers AI model ${model.trim()} was retired on 2026-05-30 (error 5028). Use ${WORKERS_AI_TEXT_MODEL}.`,
    );
  }
  if (inputs == null || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new Error("Workers AI inputs must be an object");
  }
  if (options?.signal) {
    return env.AI.run(model, inputs, { signal: options.signal });
  }
  return env.AI.run(model, inputs);
}

export function formatWorkersAiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (
    err instanceof TypeError &&
    /Cannot convert undefined or null to object|Cannot read properties of null|Cannot read properties of undefined/.test(
      message,
    )
  ) {
    return WORKERS_AI_EMPTY_RESPONSE;
  }
  const text = message.trim();
  return text || "Workers AI request failed";
}

export function readAiText(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return "";
  const value = (response as { response?: unknown }).response;
  return typeof value === "string" ? value : "";
}

export type WorkersAiTextResult =
  { ok: true; text: string } | { ok: false; error: string };

function formatCodedAiError(code: unknown, message: unknown): string | null {
  const text = typeof message === "string" ? message.trim() : "";
  const hasCode =
    typeof code === "number" || (typeof code === "string" && code.trim() !== "");
  const codeText = hasCode ? String(code).trim() : "";
  if (!text && !codeText) return null;
  if (codeText && text) return `Workers AI error ${codeText}: ${text}`;
  if (text) return `Workers AI error: ${text}`;
  return `Workers AI error ${codeText}`;
}

function describeAiErrorBody(record: Record<string, unknown>): string | null {
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const formatted = formatCodedAiError(entry.code, entry.message);
      if (formatted) return formatted;
    }
  }

  const error = record.error;
  if (typeof error === "string") {
    const formatted = formatCodedAiError(undefined, error);
    if (formatted) return formatted;
  } else if (error && typeof error === "object") {
    const entry = error as Record<string, unknown>;
    const formatted = formatCodedAiError(
      entry.code ?? entry.internalCode,
      entry.message ?? entry.description,
    );
    if (formatted) return formatted;
  }

  if (record.internalCode != null || typeof record.description === "string") {
    return formatCodedAiError(record.internalCode, record.description ?? record.message);
  }

  return null;
}

function readWorkersAiTextInner(response: unknown, depth: number): WorkersAiTextResult {
  if (response == null) {
    return { ok: false, error: WORKERS_AI_EMPTY_RESPONSE };
  }
  if (typeof response === "string") {
    return response.trim()
      ? { ok: true, text: response }
      : { ok: false, error: WORKERS_AI_EMPTY_RESPONSE };
  }
  if (typeof response !== "object" || Array.isArray(response)) {
    return { ok: false, error: "Workers AI returned an unreadable response" };
  }

  const record = response as Record<string, unknown>;
  const failure = describeAiErrorBody(record);
  if (failure) return { ok: false, error: failure };
  if (record.success === false) {
    return { ok: false, error: "Workers AI request failed" };
  }

  if (
    depth < 2 &&
    record.result != null &&
    typeof record.result === "object" &&
    record.response == null
  ) {
    const nested = readWorkersAiTextInner(record.result, depth + 1);
    if (nested.ok || nested.error !== WORKERS_AI_EMPTY_RESPONSE) return nested;
  }

  if ("response" in record && record.response == null) {
    return { ok: false, error: WORKERS_AI_EMPTY_RESPONSE };
  }

  const text = readAiText(response);
  if (!text.trim()) return { ok: false, error: WORKERS_AI_EMPTY_RESPONSE };
  return { ok: true, text };
}

/** Read a Workers AI text result without throwing on null or error envelopes. */
export function readWorkersAiText(response: unknown): WorkersAiTextResult {
  try {
    return readWorkersAiTextInner(response, 0);
  } catch (err) {
    return { ok: false, error: formatWorkersAiError(err) };
  }
}

function readAiObject(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (!chunk || typeof chunk !== "object") return "";
  const record = chunk as {
    response?: unknown;
    delta?: { content?: unknown };
  };
  if (typeof record.response === "string") return record.response;
  if (typeof record.delta?.content === "string") return record.delta.content;
  return "";
}

function sseDataPayload(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const rest = line.slice(5);
  return rest.startsWith(" ") ? rest.slice(1) : rest;
}

export type AiStreamCutoff = "error" | "length";

const TOKEN_LIMIT_REASONS = new Set(["length", "max_tokens", "token_limit"]);

function reasonIsTokenLimit(value: unknown): boolean {
  return typeof value === "string" && TOKEN_LIMIT_REASONS.has(value.trim().toLowerCase());
}

function cutoffFromRecord(
  record: Record<string, unknown>,
  maxTokens: number | undefined,
): AiStreamCutoff | null {
  if (
    typeof record.error === "string" ||
    (record.error != null && typeof record.error === "object") ||
    (Array.isArray(record.errors) && record.errors.length > 0)
  ) {
    return "error";
  }

  if (
    reasonIsTokenLimit(record.finish_reason) ||
    reasonIsTokenLimit(record.stop_reason)
  ) {
    return "length";
  }
  if (Array.isArray(record.choices)) {
    for (const choice of record.choices) {
      if (!choice || typeof choice !== "object") continue;
      const entry = choice as Record<string, unknown>;
      if (
        reasonIsTokenLimit(entry.finish_reason) ||
        reasonIsTokenLimit(entry.stop_reason)
      ) {
        return "length";
      }
    }
  }

  const usage = record.usage;
  if (maxTokens != null && usage && typeof usage === "object") {
    const completion = (usage as { completion_tokens?: unknown }).completion_tokens;
    if (typeof completion === "number" && completion >= maxTokens) return "length";
  }
  return null;
}

/** Text from one SSE event. `[DONE]` and unreadable payloads contribute nothing. */
function textFromSsePayload(
  payload: string,
  maxTokens: number | undefined,
  note: (cutoff: AiStreamCutoff) => void,
): string {
  const data = payload.trim();
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const cutoff = cutoffFromRecord(parsed as Record<string, unknown>, maxTokens);
      if (cutoff) note(cutoff);
    }
    return readAiObject(parsed);
  } catch {
    return "";
  }
}

/**
 * Incremental decoder for a Workers AI `stream: true` body.
 * The binding returns a ReadableStream of Uint8Array SSE frames
 * (`data: {"response":"..."}`, then `data: [DONE]`), and a frame can
 * be split across chunks.
 */
export function createAiStreamReader(options?: { maxTokens?: number }) {
  const decoder = new TextDecoder();
  const maxTokens = options?.maxTokens;
  let buffer = "";
  let pendingData: string[] = [];
  let sse = false;
  let eventName = "";
  let cutoff: AiStreamCutoff | null = null;

  function note(next: AiStreamCutoff) {
    if (next === "error" || cutoff == null) cutoff = next;
  }

  function flushEvent(): string {
    if (eventName === "error") note("error");
    if (pendingData.length === 0) {
      eventName = "";
      return "";
    }
    const payload = pendingData.join("\n");
    pendingData = [];
    const text = textFromSsePayload(payload, maxTokens, note);
    eventName = "";
    return text;
  }

  function consume(final: boolean): string[] {
    const out: string[] = [];
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) break;
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        if (eventName === "error") note("error");
        continue;
      }
      if (line.trim() === "") {
        const text = flushEvent();
        if (text) out.push(text);
        continue;
      }
      const payload = sseDataPayload(line);
      if (payload != null) {
        sse = true;
        pendingData.push(payload);
      }
    }
    if (final) {
      const tail = buffer.replace(/\r$/, "");
      buffer = "";
      if (tail.startsWith("event:")) {
        eventName = tail.slice(6).trim();
        if (eventName === "error") note("error");
      } else {
        const payload = sseDataPayload(tail);
        if (payload != null) pendingData.push(payload);
      }
      const text = flushEvent();
      if (text) out.push(text);
    }
    return out;
  }

  return {
    push(chunk: unknown): string[] {
      if (chunk instanceof Uint8Array) {
        sse = true;
        buffer += decoder.decode(chunk, { stream: true });
        return consume(false);
      }
      if (chunk instanceof ArrayBuffer) {
        sse = true;
        buffer += decoder.decode(new Uint8Array(chunk), { stream: true });
        return consume(false);
      }
      if (typeof chunk === "string") {
        if (sse || buffer.length > 0 || /^\s*data:/.test(chunk)) {
          sse = true;
          buffer += chunk;
          return consume(false);
        }
        return chunk ? [chunk] : [];
      }
      const text = readAiObject(chunk);
      return text ? [text] : [];
    },
    flush(): string[] {
      buffer += decoder.decode();
      return consume(true);
    },
    get cutoff(): AiStreamCutoff | null {
      return cutoff;
    },
  };
}

export function readAiChunk(chunk: unknown): string {
  if (chunk instanceof Uint8Array || chunk instanceof ArrayBuffer) {
    const reader = createAiStreamReader();
    return [...reader.push(chunk), ...reader.flush()].join("");
  }
  if (typeof chunk === "string" && /^\s*data:/m.test(chunk)) {
    const reader = createAiStreamReader();
    return [...reader.push(chunk), ...reader.flush()].join("");
  }
  return readAiObject(chunk);
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof value === "object" && Symbol.asyncIterator in value);
}
