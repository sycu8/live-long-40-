import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACUTE_CLASSIFIER_MAX_TOKENS,
  clearAcuteClassifierCache,
  isAcuteClassifierInput,
} from "../../worker/ai/acute-classifier";
import { WORKERS_AI_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";
import {
  CHAT_AI_TIMEOUT_MS,
  runChatPipeline,
  TRUNCATED_ANSWER_NOTICE,
} from "../../worker/ai/pipeline";
import { SYMPTOM_SAFETY_LINE } from "../../shared/rules/safety";
import type { Env } from "../../worker/env";

const CLASSIFIER_NONE = {
  response: JSON.stringify({
    category: "none",
    acute: false,
    intent_first_person: false,
    figurative: false,
  }),
};

function isClassifierCall(args: unknown[]): boolean {
  return isAcuteClassifierInput(args[1]);
}

function answerCachePuts(puts: { key: string; value: string }[]) {
  return puts.filter((item) => item.key.startsWith("ans_cache:"));
}

const QUESTION = "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe";

function dbWithOfficialChunk(): D1Database {
  const row = {
    chunk_id: "c1",
    content:
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn.",
    heading: "Đi bộ buổi sáng",
    source_id: "who-ageing",
    title: "Đi bộ buổi sáng cho người 61 tuổi",
    issuer: "Tổ chức Y tế Thế giới",
    publication_date: "2024-01-01",
    original_url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    status: "active",
    trust_tier: "intl_guideline",
  };
  return {
    prepare() {
      return {
        async all() {
          return { results: [row] };
        },
      };
    },
  } as unknown as D1Database;
}

const MODEL_ANSWER =
  "Người 61 tuổi nên đi bộ đều mỗi buổi sáng để giữ sức khỏe tim mạch và thăng bằng. [S1]";
const MODEL_WITH_LINE = `${MODEL_ANSWER}\n\n${SYMPTOM_SAFETY_LINE}`;

function memoryConfig() {
  const puts: { key: string; value: string }[] = [];
  const CONFIG = {
    async get() {
      return null;
    },
    async put(key: string, value: string) {
      puts.push({ key, value });
    },
  };
  return { puts, CONFIG };
}

function sseByteStream(payload: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(payload);
  const mid = Math.min(12, bytes.length - 1);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, mid));
      controller.enqueue(bytes.slice(mid));
      controller.close();
    },
  });
}

describe("chat Workers AI fallback", () => {
  beforeEach(() => {
    clearAcuteClassifierCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAcuteClassifierCache();
  });

  it("calls the fp8 model directly with an explicit max_tokens", async () => {
    const calls: unknown[][] = [];
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run(...args: unknown[]) {
          calls.push(args);
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: "Đi bộ đều giúp giữ sức khỏe. [S1]" };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);

    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("[S1]");
    expect(text.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    const chatCalls = calls.filter((args) => !isClassifierCall(args));
    const classifierCalls = calls.filter((args) => isClassifierCall(args));
    expect(classifierCalls).toHaveLength(1);
    const classifierInputs = classifierCalls[0]?.[1] as {
      max_tokens?: number;
      temperature?: number;
      response_format?: { type?: string };
    };
    expect(classifierInputs?.max_tokens).toBe(ACUTE_CLASSIFIER_MAX_TOKENS);
    expect(classifierInputs?.temperature).toBe(0);
    expect(classifierInputs && "response_format" in classifierInputs).toBe(false);
    expect(chatCalls).toHaveLength(1);
    expect(chatCalls[0]).toHaveLength(3);
    expect(chatCalls[0]?.[0]).toBe(WORKERS_AI_TEXT_MODEL);
    const options = chatCalls[0]?.[2] as { gateway?: unknown; signal?: AbortSignal };
    expect(options.gateway).toBeUndefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const inputs = chatCalls[0]?.[1] as { max_tokens?: number } | undefined;
    expect(inputs?.max_tokens).toBe(WORKERS_AI_MAX_TOKENS);
  });

  it("uses the extractive answer when Workers AI throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          throw new Error("2001: Please configure AI Gateway");
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);

    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(text).toContain("[S1]");
    expect(text).toContain("Tổ chức Y tế Thế giới");
    expect(text).toContain("nhịp đi bộ buổi sáng");
    expect(text).not.toContain("tạm thời gặp sự cố");
    expect(text).not.toContain("2001");
  });

  it("reads a Workers AI SSE byte stream instead of the extractive answer", async () => {
    const calls: unknown[][] = [];
    const { puts, CONFIG } = memoryConfig();
    const body = [
      `data: ${JSON.stringify({ response: "Người 61 tuổi nên đi bộ đều " })}`,
      "",
      `data: ${JSON.stringify({ response: "mỗi buổi sáng để giữ sức khỏe tim mạch và thăng bằng. [S1]" })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          calls.push(args);
          return sseByteStream(body);
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);

    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toBe(MODEL_WITH_LINE);
    expect(text).not.toContain("[DONE]");
    expect(text).not.toContain("Dựa trên nguồn từ cơ quan nhà nước");
    const chatCalls = calls.filter((args) => !isClassifierCall(args));
    expect(chatCalls[0]).toHaveLength(3);
    const options = chatCalls[0]?.[2] as { gateway?: unknown; signal?: AbortSignal };
    expect(options.gateway).toBeUndefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const cachedPuts = answerCachePuts(puts);
    expect(cachedPuts).toHaveLength(1);
    expect(cachedPuts[0]?.key.startsWith(`ans_cache:v6:${WORKERS_AI_TEXT_MODEL}:`)).toBe(
      true,
    );
    expect(cachedPuts[0]?.key).not.toContain("ans_cache:v5:");
    expect(cachedPuts[0]?.key).not.toContain("ans_cache:v4:");
    const cached = JSON.parse(cachedPuts[0]?.value ?? "{}") as { answer?: string };
    expect(cached.answer).toBe(MODEL_WITH_LINE);
  });

  it("does not cache an extractive fallback when the stream has no model text", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return sseByteStream("data: [DONE]\n\n");
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(text).not.toContain("\n\n---\n");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("does not cache the extractive answer when Workers AI is unbound", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("does not cache the extractive answer when Workers AI throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          throw new Error("2001: Please configure AI Gateway");
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text.startsWith("Dựa trên nguồn từ cơ quan nhà nước")).toBe(true);
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("separates a partial stream from the fallback and does not cache it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(CHAT_AI_TIMEOUT_MS).toBe(30_000);
    const { puts, CONFIG } = memoryConfig();
    const encoder = new TextEncoder();
    let signal: AbortSignal | undefined;
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          expect(args).toHaveLength(3);
          const options = args[2] as { gateway?: unknown; signal?: AbortSignal };
          expect(options.gateway).toBeUndefined();
          signal = options.signal;
          let pulls = 0;
          return new ReadableStream<Uint8Array>({
            pull(controller) {
              pulls += 1;
              if (pulls === 1) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ response: "Đi bộ " })}\n\n`),
                );
                return;
              }
              return new Promise(() => {});
            },
          });
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION, { aiTimeoutMs: 40 });
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).not.toContain("Đi bộ ");
    expect(text.startsWith("Dựa trên nguồn từ cơ quan nhà nước")).toBe(true);
    expect(answerCachePuts(puts)).toEqual([]);
    expect(signal?.aborted).toBe(true);
  });

  it("does not cache a fallback when the model answer has no citations", async () => {
    const { puts, CONFIG } = memoryConfig();
    const uncited = "Đi bộ đều giúp giữ sức khỏe, nhưng câu này không kèm nguồn.";
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: uncited };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const displayed = await readDisplayed(result.stream);
    const saved = await result.fullTextPromise;
    expect(saved).toBe(displayed);
    expect(saved).not.toContain(uncited);
    expect(saved.startsWith("Dựa trên nguồn từ cơ quan nhà nước")).toBe(true);
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("keeps a Vietnamese answer split across SSE bytes", async () => {
    const text =
      "Người 61 tuổi nên đi bộ đều mỗi buổi sáng để giữ sức khỏe tim mạch và thăng bằng. [S1]";
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify({ response: text })}\n\ndata: [DONE]\n\n`,
    );
    const splitAt = bytes.findIndex((byte, index) => index > 0 && (byte & 0xc0) === 0x80);
    expect(splitAt).toBeGreaterThan(0);
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes.slice(0, splitAt));
              controller.enqueue(bytes.slice(splitAt));
              controller.close();
            },
          });
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toBe(`${text}\n\n${SYMPTOM_SAFETY_LINE}`);
    expect(saved).not.toContain("\uFFFD");
  });

  it("keeps the last SSE event when the model omits [DONE]", async () => {
    const { puts, CONFIG } = memoryConfig();
    const body = [
      `data: ${JSON.stringify({ response: "Người 61 tuổi nên đi bộ đều " })}`,
      "",
      `data: ${JSON.stringify({ response: "mỗi buổi sáng để giữ sức khỏe tim mạch và thăng bằng. [S1]" })}`,
      "",
    ].join("\n");
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return sseByteStream(body);
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toBe(MODEL_WITH_LINE);
    expect(answerCachePuts(puts)).toHaveLength(1);
  });

  it("does not cache a cited answer that ends in an error event", async () => {
    const { puts, CONFIG } = memoryConfig();
    const body = [
      `data: ${JSON.stringify({ response: MODEL_ANSWER })}`,
      "",
      "event: error",
      'data: {"error":"upstream failed"}',
      "",
    ].join("\n");
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return sseByteStream(body);
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const displayed = await readDisplayed(result.stream);
    const saved = await result.fullTextPromise;
    expect(saved).toBe(displayed);
    expect(saved).toBe(
      `${MODEL_ANSWER}${TRUNCATED_ANSWER_NOTICE}\n\n${SYMPTOM_SAFETY_LINE}`,
    );
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("does not cache a cited answer that hits the token limit", async () => {
    const { puts, CONFIG } = memoryConfig();
    const body = [
      `data: ${JSON.stringify({ response: MODEL_ANSWER })}`,
      "",
      `data: ${JSON.stringify({
        response: "",
        finish_reason: "length",
        usage: {
          completion_tokens: WORKERS_AI_MAX_TOKENS,
          prompt_tokens: 20,
          total_tokens: WORKERS_AI_MAX_TOKENS + 20,
        },
      })}`,
      "",
    ].join("\n");
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return sseByteStream(body);
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const displayed = await readDisplayed(result.stream);
    const saved = await result.fullTextPromise;
    expect(saved).toBe(displayed);
    expect(saved).toBe(
      `${MODEL_ANSWER}${TRUNCATED_ANSWER_NOTICE}\n\n${SYMPTOM_SAFETY_LINE}`,
    );
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("drops citation markers that point at no source and does not cache them", async () => {
    const { puts, CONFIG } = memoryConfig();
    const mixed =
      "Người 61 tuổi nên đi bộ đều mỗi buổi sáng để giữ sức khỏe tim mạch và thăng bằng. [S1] Một ý không có trong nguồn. [S99]";
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: mixed };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const displayed = await readDisplayed(result.stream);
    const saved = await result.fullTextPromise;
    expect(saved).toBe(displayed);
    expect(saved).toContain("[S1]");
    expect(saved).not.toContain("[S99]");
    expect(saved).not.toContain("Một ý không có trong nguồn.");
    expect(saved).toContain(SYMPTOM_SAFETY_LINE);
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("replaces an answer that attributes a number the source does not state", async () => {
    const { puts, CONFIG } = memoryConfig();
    const claim =
      "Bộ Y tế khuyên người lớn ngủ từ 7 đến 9 giờ mỗi đêm để giữ sức khỏe tinh thần. [S1]";
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: claim };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved.startsWith("Dựa trên nguồn từ cơ quan nhà nước")).toBe(true);
    expect(saved).not.toContain("7 đến 9");
    expect(saved).not.toContain("Bộ Y tế");
    expect(saved).toContain("nhịp đi bộ buổi sáng");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("drops only the sentence with an unsupported number", async () => {
    const { puts, CONFIG } = memoryConfig();
    const mixed = `${MODEL_ANSWER} Chúng ta nên ngủ 7–9 tiếng mỗi đêm. [S1]`;
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: mixed };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toContain(MODEL_ANSWER);
    expect(saved).not.toContain("7–9");
    expect(saved).not.toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("does not cache a cited answer whose claim is absent from the source", async () => {
    const { puts, CONFIG } = memoryConfig();
    const flu =
      "Kháng sinh giúp phòng cúm mùa ở người lớn tuổi. Ở bán cầu bắc nên tiêm vắc xin từ tháng 10 đến tháng 3 mỗi năm. [S1]";
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: flu };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const displayed = await readDisplayed(result.stream);
    const saved = await result.fullTextPromise;
    expect(saved).toBe(displayed);
    expect(saved).not.toContain("tháng 10");
    expect(saved).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("filters a stream error the same way as a finished answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { puts, CONFIG } = memoryConfig();
    const junk = "Theo một nghiên cứu Lancet, hãy ngừng thuốc tiểu đường ngay. Gọi 115.";
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ response: junk })}\n\n`,
                ),
              );
              controller.error(new Error("upstream reset"));
            },
          });
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).not.toMatch(/lancet/i);
    expect(saved).not.toMatch(/ngừng thuốc/i);
    expect(saved).toMatch(/gọi 115|115/i);
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("replaces an answer that is only a citation marker", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: "[S1]" };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(saved.trim()).not.toMatch(/^\[S1\]$/);
    expect(saved).not.toContain("chưa tìm thấy đủ nguồn");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("replaces a source header with the extract when a snippet exists", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return { response: "Nguồn: [S1]" };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(saved).not.toContain("Nguồn:");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("uses the extract when the model refuses and a snippet was retrieved", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return {
            response:
              "Tôi chưa tìm thấy đủ nguồn tin cậy để trả lời câu này một cách chắc chắn.",
          };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(saved).not.toContain("chưa tìm thấy đủ nguồn");
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("stops a fully dropped stream before the 30s deadline", async () => {
    const { puts, CONFIG } = memoryConfig();
    let releaseHang: () => void = () => {};
    const hang = new Promise<void>((resolve) => {
      releaseHang = resolve;
    });
    const encoder = new TextEncoder();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          let pulls = 0;
          return new ReadableStream<Uint8Array>({
            async pull(controller) {
              pulls += 1;
              if (pulls === 1) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      response:
                        "Theo một nghiên cứu Lancet, hãy ngừng thuốc ngay. Một ý khác không có trong nguồn nào.",
                    })}\n\n`,
                  ),
                );
                return;
              }
              await hang;
              controller.close();
            },
          });
        },
      },
    } as unknown as Env;

    const started = Date.now();
    const result = await runChatPipeline(env, QUESTION, { aiTimeoutMs: 30_000 });
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    releaseHang();
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(saved).toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(saved).not.toMatch(/lancet|ngừng thuốc/i);
    expect(answerCachePuts(puts)).toEqual([]);
  });

  it("sends the first cited sentence before the model continues", async () => {
    let releaseNext: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    const encoder = new TextEncoder();
    const firstSentence = `${MODEL_ANSWER}`;
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          let pulls = 0;
          return new ReadableStream<Uint8Array>({
            async pull(controller) {
              pulls += 1;
              if (pulls === 1) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ response: firstSentence })}\n\n`,
                  ),
                );
                return;
              }
              await gate;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ response: " Câu sau không có nguồn." })}\n\n`,
                ),
              );
              controller.close();
            },
          });
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const reader = result.stream.getReader();
    const first = await reader.read();
    expect(first.value).toContain(MODEL_ANSWER);
    expect(first.value).not.toContain("Câu sau");
    releaseNext();
    let rest = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      rest += next.value ?? "";
    }
    expect(rest).not.toContain("Câu sau không có nguồn");
  });

  it("strips a model either/or 115 sentence and does not cache it", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          if (isClassifierCall(args)) return CLASSIFIER_NONE;
          return {
            response: `${MODEL_ANSWER} Gọi 115 hay đến bệnh viện. Có thể gọi 115 hoặc nhờ người nhà.`,
          };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const saved = await result.fullTextPromise;
    expect(saved).toContain(MODEL_ANSWER);
    expect(saved).not.toMatch(/hay đến bệnh viện|hoặc nhờ người nhà/i);
    expect(saved.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(answerCachePuts(puts)).toEqual([]);
  });
});

async function readDisplayed(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += value;
  }
  return out;
}
