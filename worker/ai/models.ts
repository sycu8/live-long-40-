/**
 * Workers AI chat model for blog drafts and grounded answers.
 *
 * The unversioned Llama 3.1 8B instruct id was removed from the catalog on
 * 2026-05-30 and now fails with error 5028. The `-fast` variant stayed active:
 * https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/
 */
export const WORKERS_AI_TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

/** Model ids Cloudflare retired on 2026-05-30 (Workers AI error 5028). */
export const RETIRED_WORKERS_AI_MODELS = [
  "@cf/moonshotai/kimi-k2.5",
  "@hf/meta-llama/meta-llama-3-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/meta/llama-3-8b-instruct-awq",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-awq",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-2-7b-chat-int8",
  "@cf/meta/llama-2-7b-chat-fp16",
  "@cf/mistral/mistral-7b-instruct-v0.1",
  "@hf/mistral/mistral-7b-instruct-v0.2",
  "@hf/google/gemma-7b-it",
  "@cf/google/gemma-3-12b-it",
  "@hf/nousresearch/hermes-2-pro-mistral-7b",
  "@cf/microsoft/phi-2",
  "@cf/defog/sqlcoder-7b-2",
  "@cf/unum/uform-gen2-qwen-500m",
  "@cf/facebook/bart-large-cnn",
] as const;

const RETIRED_WORKERS_AI_MODEL_SET = new Set<string>(RETIRED_WORKERS_AI_MODELS);

export function isRetiredWorkersAiModel(model: string): boolean {
  return RETIRED_WORKERS_AI_MODEL_SET.has(model.trim());
}
