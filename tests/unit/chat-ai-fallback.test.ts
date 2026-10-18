import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKERS_AI_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";
import { CHAT_AI_TIMEOUT_MS, runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the fp8 model directly with an explicit max_tokens", async () => {
    const calls: unknown[][] = [];
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run(...args: unknown[]) {
          calls.push(args);
          return { response: "Đi bộ đều giúp giữ sức khỏe. [S1]" };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);

    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("[S1]");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(calls[0]?.[0]).toBe(WORKERS_AI_TEXT_MODEL);
    const inputs = calls[0]?.[1] as { max_tokens?: number } | undefined;
    expect(inputs?.max_tokens).toBe(WORKERS_AI_MAX_TOKENS);
  });

  it("uses the extractive answer when Workers AI throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run() {
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
          calls.push(args);
          return sseByteStream(body);
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);

    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toBe(MODEL_ANSWER);
    expect(text).not.toContain("[DONE]");
    expect(text).not.toContain("Dựa trên nguồn từ cơ quan nhà nước");
    expect(calls[0]).toHaveLength(2);
    expect(puts).toHaveLength(1);
    expect(puts[0]?.key.startsWith(`ans_cache:v3:${WORKERS_AI_TEXT_MODEL}:`)).toBe(true);
    expect(puts[0]?.key).not.toContain("ans_cache:v2:");
    const cached = JSON.parse(puts[0]?.value ?? "{}") as { answer?: string };
    expect(cached.answer).toBe(MODEL_ANSWER);
  });

  it("does not cache an extractive fallback when the stream has no model text", async () => {
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run() {
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
    expect(puts).toEqual([]);
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
    expect(puts).toEqual([]);
  });

  it("does not cache the extractive answer when Workers AI throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { puts, CONFIG } = memoryConfig();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run() {
          throw new Error("2001: Please configure AI Gateway");
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, QUESTION);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text.startsWith("Dựa trên nguồn từ cơ quan nhà nước")).toBe(true);
    expect(puts).toEqual([]);
  });

  it("separates a partial stream from the fallback and does not cache it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(CHAT_AI_TIMEOUT_MS).toBe(30_000);
    const { puts, CONFIG } = memoryConfig();
    const encoder = new TextEncoder();
    const env = {
      DB: dbWithOfficialChunk(),
      CONFIG,
      AI: {
        async run(...args: unknown[]) {
          expect(args).toHaveLength(2);
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
    expect(text.startsWith("Đi bộ ")).toBe(true);
    expect(text).toContain("\n\n---\nDựa trên nguồn từ cơ quan nhà nước");
    expect(puts).toEqual([]);
  });
});
