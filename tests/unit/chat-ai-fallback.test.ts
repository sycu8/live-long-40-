import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKERS_AI_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

const QUESTION =
  "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe";

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
});
