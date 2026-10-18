import type { Env } from "../env";

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

export async function runWorkersAi(
  env: Env,
  model: string,
  inputs: Record<string, unknown>,
): Promise<unknown> {
  if (!env.AI) {
    throw new Error("Workers AI binding is unavailable");
  }
  return env.AI.run(model, inputs, workersAiRunOptions(env.AI_GATEWAY_ID));
}

export function readAiText(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return "";
  const value = (response as { response?: unknown }).response;
  return typeof value === "string" ? value : "";
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
