import { describe, expect, it } from "vitest";
import { WORKERS_AI_MAX_TOKENS, WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";
import { readAiText, runWorkersAi } from "../../worker/ai/run";
import { generateEditorialPostWithAi } from "../../worker/blog/generate-ai";
import { generateAndStoreBlogCover } from "../../worker/blog/images";
import type { Env } from "../../worker/env";

const MODEL = WORKERS_AI_TEXT_MODEL;

function aiBinding(run: Ai["run"]): Ai {
  return { run } as unknown as Ai;
}

function editorialJson(): string {
  const body = [
    Array.from({ length: 320 }, (_, i) => `tu${i}`).join(" "),
    "Xem [thư viện](/thu-vien) và [Hỏi VivaAge](/hoi).",
  ].join("\n\n");
  return JSON.stringify({
    title: "Một việc nhỏ cho tuần này",
    excerpt: "Chọn một việc vừa sức và làm đều trong tuần.",
    minutes: 8,
    sourceIds: ["who-ageing"],
    body,
  });
}

describe("workers AI direct binding", () => {
  it("drafts a post with env.AI.run(model, inputs) and no gateway options", async () => {
    const calls: unknown[][] = [];
    const env = {
      AI: aiBinding(async (...args) => {
        calls.push(args);
        return { response: editorialJson() };
      }),
    } as unknown as Env;

    const post = await generateEditorialPostWithAi(env, "2026-10-18", 0);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(calls[0]?.[0]).toBe(MODEL);
    const inputs = calls[0]?.[1] as { max_tokens?: number } | undefined;
    expect(inputs?.max_tokens).toBe(WORKERS_AI_MAX_TOKENS);
    expect(post?.title).toBe("Một việc nhỏ cho tuần này");
    expect(post?.sourceIds).toContain("who-ageing");
    expect(post?.body).toContain("/thu-vien");
  });

  it("stores a blog cover with a direct Workers AI call", async () => {
    const calls: unknown[][] = [];
    const image = Buffer.from("A".repeat(300)).toString("base64");
    let storedKey = "";
    const env = {
      AI: aiBinding(async (...args) => {
        calls.push(args);
        return { image };
      }),
      SOURCES: {
        async put(key: string) {
          storedKey = key;
        },
      },
    } as unknown as Env;

    const cover = await generateAndStoreBlogCover(
      env,
      "mot-viec-nho",
      "Một việc nhỏ",
      "thoi-quen",
    );

    expect(cover?.key).toBe("blog-covers/mot-viec-nho.png");
    expect(storedKey).toBe("blog-covers/mot-viec-nho.png");
    expect(calls[0]?.[0]).toBe("@cf/black-forest-labs/flux-1-schnell");
    expect(calls[0]).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  it("runWorkersAi forwards model and inputs without gateway options", async () => {
    const calls: unknown[][] = [];
    const env = {
      AI: aiBinding(async (...args) => {
        calls.push(args);
        return { response: "ok" };
      }),
    } as unknown as Env;

    const response = await runWorkersAi(env, MODEL, {
      messages: [{ role: "user", content: "xin chào" }],
      stream: false,
      max_tokens: WORKERS_AI_MAX_TOKENS,
    });

    expect(readAiText(response)).toBe("ok");
    expect(calls[0]).toHaveLength(2);
    expect(calls[0]?.[0]).toBe(MODEL);
    expect(calls[0]?.[1]).toEqual({
      messages: [{ role: "user", content: "xin chào" }],
      stream: false,
      max_tokens: WORKERS_AI_MAX_TOKENS,
    });
  });
});
