import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isRetiredWorkersAiModel,
  RETIRED_WORKERS_AI_MODELS,
  WORKERS_AI_TEXT_MODEL,
} from "../../worker/ai/models";
import {
  formatWorkersAiError,
  readWorkersAiText,
  runWorkersAi,
  WORKERS_AI_EMPTY_RESPONSE,
} from "../../worker/ai/run";
import { generateEditorialPostWithAi } from "../../worker/blog/generate-ai";
import type { Env } from "../../worker/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const retiredModel = "@cf/meta/llama-3.1-8b-instruct";

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...walkTs(full));
      continue;
    }
    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function retiredIdPattern(id: string): RegExp {
  return new RegExp(`${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![-\\w])`);
}

describe("Workers AI model catalog", () => {
  it("uses the active llama 3.1 8B fast model", () => {
    expect(WORKERS_AI_TEXT_MODEL).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(isRetiredWorkersAiModel(WORKERS_AI_TEXT_MODEL)).toBe(false);
    expect(RETIRED_WORKERS_AI_MODELS).toContain(retiredModel);
  });

  it("fails if a known retired model id is used", () => {
    const allow = new Set([
      path.join(root, "worker/ai/models.ts"),
      path.join(root, "tests/unit/workers-ai-model.test.ts"),
    ]);
    const hits: string[] = [];
    const files = [
      ...walkTs(path.join(root, "worker")),
      ...walkTs(path.join(root, "tests")),
    ];
    for (const file of files) {
      if (allow.has(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const id of RETIRED_WORKERS_AI_MODELS) {
        if (retiredIdPattern(id).test(src)) {
          hits.push(`${path.relative(root, file)} uses ${id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("rejects a retired model before the binding can throw", async () => {
    let called = false;
    const env = {
      AI: {
        async run() {
          called = true;
          return { response: "should not run" };
        },
      },
    } as unknown as Env;

    await expect(
      runWorkersAi(env, retiredModel, { messages: [], stream: false }),
    ).rejects.toThrow(/retired on 2026-05-30 \(error 5028\)/);
    expect(called).toBe(false);
  });
});

describe("Workers AI response parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when the response is null", () => {
    expect(() => readWorkersAiText(null)).not.toThrow();
    expect(readWorkersAiText(null)).toEqual({
      ok: false,
      error: WORKERS_AI_EMPTY_RESPONSE,
    });
    expect(readWorkersAiText({ response: null })).toEqual({
      ok: false,
      error: WORKERS_AI_EMPTY_RESPONSE,
    });
    expect(
      formatWorkersAiError(new TypeError("Cannot convert undefined or null to object")),
    ).toBe(WORKERS_AI_EMPTY_RESPONSE);
  });

  it("reports a retired-model error envelope without throwing", () => {
    const read = readWorkersAiText({
      success: false,
      result: null,
      errors: [
        {
          code: 5028,
          message:
            "This model was deprecated on 2026-05-30. Please use an alternative model",
        },
      ],
    });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error).toContain("5028");
      expect(read.error).toContain("deprecated on 2026-05-30");
      expect(read.error).not.toContain("TypeError");
    }
  });

  it("logs a failed blog draft instead of throwing TypeError", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => {
      logged.push(String(message));
    });
    const env = {
      AI: {
        async run() {
          throw new TypeError("Cannot convert undefined or null to object");
        },
      },
    } as unknown as Env;

    const post = await generateEditorialPostWithAi(env, "2026-10-18", 0);

    expect(post).toBeNull();
    expect(logged).toHaveLength(1);
    const payload = JSON.parse(logged[0] ?? "{}") as {
      message?: string;
      model?: string;
      error?: string;
    };
    expect(payload.message).toBe("blog_ai_generate_failed");
    expect(payload.model).toBe(WORKERS_AI_TEXT_MODEL);
    expect(payload.error).toBe(WORKERS_AI_EMPTY_RESPONSE);
    expect(payload.error).not.toContain("TypeError");
  });

  it("logs error 5028 when Workers AI returns a failure body", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message) => {
      logged.push(String(message));
    });
    const env = {
      AI_GATEWAY_ID: "song-an-40",
      AI: {
        async run() {
          return {
            success: false,
            result: null,
            errors: [
              {
                code: 5028,
                message:
                  "This model was deprecated on 2026-05-30. Please use an alternative model",
              },
            ],
          };
        },
      },
    } as unknown as Env;

    await expect(generateEditorialPostWithAi(env, "2026-10-18", 0)).resolves.toBeNull();

    const payload = JSON.parse(logged[0] ?? "{}") as { error?: string; model?: string };
    expect(payload.model).toBe(WORKERS_AI_TEXT_MODEL);
    expect(payload.error).toContain("5028");
    expect(payload.error).not.toContain("TypeError");
  });
});
