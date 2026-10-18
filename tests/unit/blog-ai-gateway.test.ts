import { describe, expect, it } from "vitest";
import { WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";
import { readAiText, runWorkersAi, workersAiRunOptions } from "../../worker/ai/run";
import { generateEditorialPostWithAi } from "../../worker/blog/generate-ai";
import { generateAndStoreBlogCover } from "../../worker/blog/images";
import type { Env } from "../../worker/env";

const MODEL = WORKERS_AI_TEXT_MODEL;

/**
 * workerd `AiGateway.run` (universal endpoint) does `Object.entries(req.headers)`.
 * `run(model, inputs)` passes a string, so `headers` is undefined and throws.
 */
function universalGatewayRun(data: unknown): void {
  const input = Array.isArray(data) ? data : [data];
  for (const req of input) {
    const headers = (req as { headers?: object }).headers;
    for (const [, value] of Object.entries(headers as object)) {
      void value;
    }
  }
}

function aiBinding(run: Ai["run"]): Ai {
  return {
    run,
    gateway(id: string) {
      return {
        run(data: unknown) {
          void id;
          universalGatewayRun(data);
          return Promise.resolve(new Response("universal"));
        },
      };
    },
  } as unknown as Ai;
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

describe("workers AI gateway routing", () => {
  it("builds gateway options only when an id is set", () => {
    expect(workersAiRunOptions("song-an-40")).toEqual({
      gateway: { id: "song-an-40" },
    });
    expect(workersAiRunOptions("  song-an-40  ")).toEqual({
      gateway: { id: "song-an-40" },
    });
    expect(workersAiRunOptions("")).toBeUndefined();
    expect(workersAiRunOptions("   ")).toBeUndefined();
    expect(workersAiRunOptions(undefined)).toBeUndefined();
  });

  it("throws the production TypeError when gateway.run receives (model, inputs)", () => {
    expect(() => universalGatewayRun(MODEL)).toThrow(TypeError);
    expect(() => universalGatewayRun(MODEL)).toThrow(
      /Cannot convert undefined or null to object/,
    );
  });

  it("routes a scheduled editorial draft through env.AI.run gateway options", async () => {
    const calls: unknown[][] = [];
    let gatewayCalled = false;
    const env = {
      AI_GATEWAY_ID: "song-an-40",
      AI: {
        async run(...args: unknown[]) {
          calls.push(args);
          return { response: editorialJson() };
        },
        gateway() {
          gatewayCalled = true;
          return {
            run(data: unknown) {
              universalGatewayRun(data);
            },
          };
        },
      },
    } as unknown as Env;

    const post = await generateEditorialPostWithAi(env, "2026-10-18", 0);

    expect(gatewayCalled).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(MODEL);
    expect(calls[0]?.[2]).toEqual({ gateway: { id: "song-an-40" } });
    expect(post?.title).toBe("Một việc nhỏ cho tuần này");
    expect(post?.sourceIds).toContain("who-ageing");
    expect(post?.body).toContain("/thu-vien");
  });

  it("calls env.AI.run without gateway options when AI_GATEWAY_ID is empty", async () => {
    const calls: unknown[][] = [];
    const env = {
      AI_GATEWAY_ID: "",
      AI: aiBinding(async (...args) => {
        calls.push(args);
        return { response: editorialJson() };
      }),
    } as unknown as Env;

    const post = await generateEditorialPostWithAi(env, "2026-10-18", 0);

    expect(post).not.toBeNull();
    expect(calls[0]?.[2]).toBeUndefined();
  });

  it("stores a blog cover using the same gateway options", async () => {
    const calls: unknown[][] = [];
    const image = Buffer.from("A".repeat(300)).toString("base64");
    let storedKey = "";
    const env = {
      AI_GATEWAY_ID: "song-an-40",
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
    expect(calls[0]?.[2]).toEqual({ gateway: { id: "song-an-40" } });
    expect(calls).toHaveLength(1);
  });

  it("runWorkersAi forwards model, inputs, and gateway id", async () => {
    const calls: unknown[][] = [];
    const env = {
      AI_GATEWAY_ID: "song-an-40",
      AI: aiBinding(async (...args) => {
        calls.push(args);
        return { response: "ok" };
      }),
    } as unknown as Env;

    const response = await runWorkersAi(env, MODEL, {
      messages: [{ role: "user", content: "xin chào" }],
      stream: false,
    });

    expect(readAiText(response)).toBe("ok");
    expect(calls[0]?.[0]).toBe(MODEL);
    expect(calls[0]?.[1]).toEqual({
      messages: [{ role: "user", content: "xin chào" }],
      stream: false,
    });
    expect(calls[0]?.[2]).toEqual({ gateway: { id: "song-an-40" } });
  });
});
