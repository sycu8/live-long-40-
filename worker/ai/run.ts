import type { Env } from "../env";
import { isRetiredWorkersAiModel, WORKERS_AI_TEXT_MODEL } from "./models";

/**
 * Options for `env.AI.run()` that send the request through AI Gateway.
 *
 * Workers AI inference uses `env.AI.run(model, inputs, { gateway: { id } })`.
 * `env.AI.gateway(id).run()` is the universal-endpoint client. It expects
 * `{ provider, endpoint, headers, query }` and reads `request.headers` with
 * `Object.entries`. Calling it as `run(model, inputs)` therefore throws
 * `TypeError: Cannot convert undefined or null to object`.
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/
 */
export function workersAiRunOptions(
  gatewayId: string | undefined | null,
): { gateway: { id: string } } | undefined {
  const id = gatewayId?.trim();
  if (!id) return undefined;
  return { gateway: { id } };
}

export const WORKERS_AI_EMPTY_RESPONSE = "Workers AI returned an empty response";

export async function runWorkersAi(
  env: Env,
  model: string,
  inputs: Record<string, unknown> | null | undefined,
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
  return env.AI.run(model, inputs, workersAiRunOptions(env.AI_GATEWAY_ID));
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

export function readAiChunk(chunk: unknown): string {
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

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof value === "object" && Symbol.asyncIterator in value);
}
