import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACUTE_CLASSIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  selfHarmLooksPastStable,
  SYMPTOM_SAFETY_LINE,
} from "../../shared/rules/safety";
import {
  ACUTE_CLASSIFIER_CACHE_TTL_SECONDS,
  ACUTE_CLASSIFIER_TIMEOUT_MS,
  acuteClassifierCacheKey,
  classifyAcuteRisk,
  clearAcuteClassifierCache,
  parseAcuteClassifierOutput,
  type AcuteVerdict,
} from "../../worker/ai/acute-classifier";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

const NONE: AcuteVerdict = {
  category: "none",
  acute: false,
  intent_first_person: false,
  figurative: false,
};

function verdict(
  partial: Partial<AcuteVerdict> & Pick<AcuteVerdict, "category">,
): AcuteVerdict {
  return {
    acute: false,
    intent_first_person: false,
    figurative: false,
    ...partial,
  };
}

describe("acute classifier JSON", () => {
  beforeEach(() => {
    clearAcuteClassifierCache();
  });

  afterEach(() => {
    clearAcuteClassifierCache();
  });

  it("accepts one object and rejects a loose reading", () => {
    expect(parseAcuteClassifierOutput(JSON.stringify(NONE))).toEqual(NONE);
    expect(
      parseAcuteClassifierOutput(
        "```json\n" +
          JSON.stringify(verdict({ category: "chest", acute: true })) +
          "\n```",
      ),
    ).toEqual(verdict({ category: "chest", acute: true }));
    expect(parseAcuteClassifierOutput("")).toBeNull();
    expect(parseAcuteClassifierOutput("not json")).toBeNull();
    expect(
      parseAcuteClassifierOutput(JSON.stringify({ ...NONE, acute: "true" })),
    ).toEqual({ ...NONE, acute: true });
    expect(
      parseAcuteClassifierOutput(
        `Phân loại xong: ${JSON.stringify({ ...NONE, figurative: "false" })} hết.`,
      ),
    ).toEqual(NONE);
    expect(
      parseAcuteClassifierOutput(JSON.stringify({ ...NONE, acute: "yes" })),
    ).toBeNull();
    expect(
      parseAcuteClassifierOutput(JSON.stringify({ ...NONE, note: "extra" })),
    ).toBeNull();
    expect(parseAcuteClassifierOutput(JSON.stringify({ category: "chest" }))).toBeNull();
    expect(
      parseAcuteClassifierOutput(JSON.stringify({ ...NONE, category: "choking" })),
    ).toBeNull();
  });

  it("does not copy QA wording into the prompt", () => {
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).toContain("ACUTE_RISK_JSON");
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).not.toContain(
      "Bố đau ngực dữ dội lan ra tay trái",
    );
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).not.toContain("F40");
  });

  it("keeps a rule hit when the classifier would hang", async () => {
    let calls = 0;
    const env = {
      AI: {
        async run() {
          calls += 1;
          return new Promise(() => undefined);
        },
      },
    } as unknown as Env;
    const started = performance.now();
    const result = await runChatPipeline(env, "toi muon tu tu", {
      classifierTimeoutMs: 30,
    });
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("self_harm");
    expect(result.message).toMatch(/gọi 115/i);
    expect(result.message).not.toContain("1900");
    expect(calls).toBe(0);
    expect(performance.now() - started).toBeLessThan(400);
  });

  it("promotes a rule miss when the classifier says acute", async () => {
    const question = "Tim đập loạn, đổ mồ hôi lạnh, không dám cử động";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({ category: "chest", acute: true }),
      }),
    });
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("chest_pain");
    expect(result.message).toContain("Không tự cho thuốc");
    expect(result.message).not.toContain(SYMPTOM_SAFETY_LINE);
  });

  it("does not show the crisis screen for a figurative idiom", async () => {
    const question = "Khổ muốn chết vì xếp hàng lấy số";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: true,
        }),
      }),
      verifyCrisis: async () => false,
    });
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).not.toContain("Nên làm");
    expect(result.message).not.toContain("1900 1267");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("offers the gentle line when an ambiguous phrase times out", async () => {
    const question = "Chán muốn chết vì kẹt xe ngoài phố";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const env = {
      AI: {
        async run() {
          return new Promise(() => undefined);
        },
      },
    } as unknown as Env;
    const started = performance.now();
    const result = await runChatPipeline(env, question, { classifierTimeoutMs: 40 });
    expect(performance.now() - started).toBeLessThan(200);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).not.toContain("Nên làm");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("appends 115 when the classifier returns malformed or empty JSON", async () => {
    const question = "Vitamin D liều cao có nên uống mỗi ngày không?";
    expect(evaluateHighRisk(question).matched).toBe(false);
    for (const response of [
      "not json",
      "   ",
      JSON.stringify({ ...NONE, acute: "true" }),
    ]) {
      clearAcuteClassifierCache();
      const result = await runChatPipeline(
        {
          AI: {
            async run() {
              return { response };
            },
          },
        } as unknown as Env,
        question,
      );
      expect(result.kind, response).toBe("abstain");
      if (result.kind !== "abstain") continue;
      expect(result.message, response).toContain("chưa tìm thấy đủ nguồn");
      expect(result.message.endsWith(SYMPTOM_SAFETY_LINE), response).toBe(true);
      expect(result.message, response).not.toContain("1900 1267");
      expect(result.message, response).not.toContain("Nên làm");
    }
  });

  it("caches a parsed verdict by the normalized question", async () => {
    let calls = 0;
    const env = {
      AI: {
        async run() {
          calls += 1;
          return { response: JSON.stringify(NONE) };
        },
      },
      CONFIG: {
        async get() {
          return null;
        },
        async put() {
          return undefined;
        },
      },
    } as unknown as Env;
    const question = "Ngủ đủ bảy giờ có tốt cho người già không?";
    const first = await classifyAcuteRisk(env, question);
    const second = await classifyAcuteRisk(env, question);
    expect(first).toEqual({ status: "ok", verdict: NONE, cached: false });
    expect(second).toEqual({ status: "ok", verdict: NONE, cached: true });
    expect(calls).toBe(1);
    expect(ACUTE_CLASSIFIER_TIMEOUT_MS).toBe(3500);
  });

  it("fails immediately when Workers AI is not bound", async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      errors.push(String(line));
    });
    const question = "Ngủ đủ bảy giờ có tốt không?";
    const result = await classifyAcuteRisk({} as Env, question);
    spy.mockRestore();
    expect(result).toEqual({ status: "fail", reason: "unavailable" });
    expect(errors.join("\n")).toContain("acute_classifier_unavailable");
    expect(errors.join("\n")).toContain("binding_missing");
    expect(errors.join("\n")).not.toContain(question);
  });

  it("shows the crisis screen when the classifier reports literal intent", async () => {
    const question = "Em viết thư từ biệt rồi cài then cửa";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: false,
        }),
      }),
      verifyCrisis: async () => true,
    });
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("self_harm");
    expect(result.message).toMatch(/gọi 115/i);
    expect(result.message).not.toContain("1900");
    expect(result.message).toContain("Nên làm");
    expect(result.message).not.toContain(SYMPTOM_SAFETY_LINE);
  });

  it("records local overhead with the classifier on", async () => {
    const classifySamples: number[] = [];
    const pipelineSamples: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      clearAcuteClassifierCache();
      const env = {
        AI: {
          async run() {
            return { response: JSON.stringify(NONE) };
          },
        },
      } as unknown as Env;
      const question = `Người ${60 + i} tuổi nên đi bộ buổi sáng chứ`;
      const started = performance.now();
      const result = await classifyAcuteRisk(env, question);
      classifySamples.push(performance.now() - started);
      expect(result.status).toBe("ok");

      clearAcuteClassifierCache();
      const pipeStart = performance.now();
      const piped = await runChatPipeline(env, question);
      pipelineSamples.push(performance.now() - pipeStart);
      expect(piped.kind).toBe("abstain");
    }
    const percentile = (samples: number[], ratio: number) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
    };
    const latency = {
      classifier_ms: {
        n: classifySamples.length,
        p50: percentile(classifySamples, 0.5),
        p95: percentile(classifySamples, 0.95),
      },
      pipeline_ms: {
        n: pipelineSamples.length,
        p50: percentile(pipelineSamples, 0.5),
        p95: percentile(pipelineSamples, 0.95),
      },
    };
    console.log(JSON.stringify({ acute_latency_local_ms: latency }));
    expect(latency.classifier_ms.p95).toBeLessThan(500);
    expect(latency.pipeline_ms.p95).toBeLessThan(500);
  });

  it("uses one classifier call and does not retry a timeout or bad JSON", async () => {
    let calls = 0;
    const env = {
      AI: {
        async run() {
          calls += 1;
          return { response: "not json" };
        },
      },
    } as unknown as Env;
    const parsed = await classifyAcuteRisk(env, "Người già nên ngủ mấy giờ?");
    expect(parsed).toEqual({ status: "fail", reason: "parse" });
    expect(calls).toBe(1);

    clearAcuteClassifierCache();
    let hung = 0;
    const slow = {
      AI: {
        async run() {
          hung += 1;
          return new Promise(() => undefined);
        },
      },
    } as unknown as Env;
    const timed = await classifyAcuteRisk(slow, "Người già nên uống nước lúc nào?", {
      timeoutMs: 40,
    });
    expect(timed).toEqual({ status: "fail", reason: "timeout" });
    expect(hung).toBe(1);
  });

  it("does not retry when the model rejects JSON schema", async () => {
    let calls = 0;
    const env = {
      AI: {
        async run() {
          calls += 1;
          return {
            error: {
              code: 5025,
              message: "This model doesn't support JSON Schema",
            },
          };
        },
      },
    } as unknown as Env;
    const failed = await classifyAcuteRisk(env, "Người già nên ngủ mấy giờ là đủ?");
    expect(failed).toEqual({ status: "fail", reason: "unsupported" });
    expect(calls).toBe(1);
  });

  it("stores a hash key and a short TTL, not the question", async () => {
    const puts: Array<{ key: string; value: string; ttl?: number }> = [];
    const question = "Ngủ trưa mười lăm phút có lợi không?";
    const env = {
      AI: {
        async run() {
          return { response: JSON.stringify(NONE) };
        },
      },
      CONFIG: {
        async get() {
          return null;
        },
        async put(key: string, value: string, options?: { expirationTtl?: number }) {
          puts.push({ key, value, ttl: options?.expirationTtl });
        },
      },
    } as unknown as Env;
    await classifyAcuteRisk(env, question);
    expect(puts).toHaveLength(1);
    const saved = puts[0]!;
    expect(saved.key).toMatch(/^acute_clf:v2:[0-9a-f]{64}$/);
    expect(saved.key).toBe(
      await acuteClassifierCacheKey("ngu trua muoi lam phut co loi khong"),
    );
    expect(saved.key).not.toContain("ngu");
    expect(saved.value).not.toContain(question);
    expect(saved.value).not.toContain("ngu trua");
    expect(saved.ttl).toBe(ACUTE_CLASSIFIER_CACHE_TTL_SECONDS);
    expect(saved.ttl).toBeLessThanOrEqual(15 * 60);
    expect(saved.ttl).toBeGreaterThanOrEqual(60);
  });

  it("does not wait for the classifier before the first token", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const env = {
      DB: {
        prepare() {
          return {
            async all() {
              return {
                results: [
                  {
                    chunk_id: "c1",
                    content: "Đi bộ đều mỗi sáng.",
                    heading: "Đi bộ",
                    source_id: "who-ageing",
                    title: "Đi bộ",
                    issuer: "Tổ chức Y tế Thế giới",
                    publication_date: "2024-01-01",
                    original_url:
                      "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
                    status: "active",
                    trust_tier: "intl_guideline",
                  },
                ],
              };
            },
          };
        },
      },
      AI: {
        async run(...args: unknown[]) {
          const inputs = args[1] as { messages?: Array<{ content?: string }> };
          const system = inputs?.messages?.[0]?.content ?? "";
          if (system.includes("ACUTE_RISK_JSON")) {
            await gate;
            return { response: JSON.stringify(NONE) };
          }
          return { response: "Đi bộ đều mỗi sáng giúp giữ sức. [S1]" };
        },
      },
    } as unknown as Env;
    const started = performance.now();
    const result = await runChatPipeline(
      env,
      "Người 70 tuổi nên đi bộ buổi sáng thế nào?",
    );
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const reader = result.stream.getReader();
    const first = await reader.read();
    const firstTokenMs = performance.now() - started;
    expect(first.value).toContain("Đi bộ");
    console.log(JSON.stringify({ first_token_ms: Math.round(firstTokenMs * 10) / 10 }));
    expect(firstTokenMs).toBeLessThan(300);
    release();
    let rest = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      rest += next.value ?? "";
    }
    const saved = await result.fullTextPromise;
    expect(saved.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(`${first.value ?? ""}${rest}`).toBe(saved);
  });

  it("uses the breathing screen when the classifier says poisoning", async () => {
    const breathing = await runChatPipeline({} as Env, "Bé thở nông, môi tái", {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({ category: "poisoning", acute: true }),
      }),
    });
    expect(breathing.kind).toBe("high_risk");
    if (breathing.kind === "high_risk") {
      expect(breathing.riskClass).toBe("breathing");
      expect(breathing.message).toMatch(/gọi 115/i);
      expect(breathing.message).toContain("Nên làm");
      expect(breathing.message).not.toContain("1900");
    }

    const seizure = await runChatPipeline(
      {} as Env,
      "Uống nhầm thìa thuốc rồi giật không dừng",
      {
        classifyAcute: async () => ({
          status: "ok",
          cached: false,
          verdict: verdict({ category: "poisoning", acute: true }),
        }),
      },
    );
    expect(evaluateHighRisk("Uống nhầm thìa thuốc rồi giật không dừng").riskClass).toBe(
      "seizure",
    );
    expect(seizure.kind).toBe("high_risk");
    if (seizure.kind === "high_risk") expect(seizure.riskClass).toBe("seizure");
  });

  it("keeps a stable chest question off the emergency screen", async () => {
    const question = "Đau ngực khi gắng sức thì khám định kỳ ra sao?";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({ category: "chest", acute: true }),
      }),
    });
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).not.toContain("Nên làm");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("does not treat an exaggeration faint or idiom as a crisis", async () => {
    const faint = "Cô cười ngất khi nghe chuyện cũ";
    expect(evaluateHighRisk(faint).matched).toBe(false);
    const faintResult = await runChatPipeline({} as Env, faint, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({ category: "unconscious", acute: true }),
      }),
    });
    expect(faintResult.kind).toBe("abstain");
    if (faintResult.kind === "abstain") {
      expect(faintResult.message).not.toContain("Nên làm");
      expect(faintResult.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    }

    const idiom = "Đau vai muốn chết khi nằm nghiêng";
    const idiomResult = await runChatPipeline({} as Env, idiom, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: verdict({
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: false,
        }),
      }),
      verifyCrisis: async () => false,
    });
    expect(idiomResult.kind).not.toBe("high_risk");
    if (idiomResult.kind === "abstain") {
      expect(idiomResult.message).not.toContain("Nên làm");
      expect(idiomResult.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    }
  });

  it("answers a prevention question with support and 115, not the crisis screen", async () => {
    const question = "Làm sao phòng ngừa tự tử ở người cao tuổi?";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(result.message).not.toContain("Nên làm");
  });

  it("keeps a negated emergency mention off the screen", async () => {
    for (const question of [
      "Tôi không bị đau ngực",
      "Bé không co giật",
      "Tôi không muốn tự tử",
      "Hết đau ngực rồi",
      "Tôi không bị đột quỵ",
    ]) {
      const result = evaluateHighRisk(question);
      expect(result.matched, question).toBe(false);
    }
    const denied = await runChatPipeline({} as Env, "Tôi không muốn tự tử");
    expect(denied.kind).toBe("high_risk");
    if (denied.kind === "high_risk") {
      expect(denied.riskClass).toBe("urgent");
      expect(denied.message).toMatch(/gọi 115/i);
      expect(denied.message).not.toContain("Ở lại bên cạnh");
      expect(denied.message).not.toContain("1900");
    }
    expect(evaluateHighRisk("Tôi không muốn sống nữa").riskClass).toBe("self_harm");
    expect(evaluateHighRisk("Không thở được").riskClass).toBe("breathing");
    expect(evaluateHighRisk("Máu chảy không cầm").riskClass).toBe("bleeding");
    expect(evaluateHighRisk("Cháu đang giật không ngừng").riskClass).toBe("seizure");
  });

  it("routes a past self-harm thought to the support line", async () => {
    const question = "Tôi từng muốn tự tử, bây giờ ổn";
    expect(selfHarmLooksPastStable(question)).toBe(true);
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).not.toContain("1900");
    expect(GENTLE_SUPPORT_LINE).toContain("115");
    expect(result.message).not.toContain("Nên làm");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("lets self-harm outrank a poisoning screen and keeps the hotline", () => {
    const question = "Em uống hết thuốc ngủ để chết";
    const result = evaluateHighRisk(question);
    expect(result.riskClass).toBe("self_harm");
    expect(result.message).toMatch(/gọi 115/i);
    expect(result.message).not.toContain("1900");
    expect(result.message).toContain("Nên làm");
  });

  it("does not add the support line to a stroke information question", async () => {
    const question = "Dấu hiệu đột quỵ ở người già gồm những gì?";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const result = await runChatPipeline({} as Env, question);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).not.toContain("1900 1267");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("leaves the live eval script out of CI", () => {
    const pkg = readFileSync("package.json", "utf8");
    const workflow = readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
    expect(pkg).not.toContain("acute-live-eval");
    expect(pkg).not.toContain("acute-classifier-smoke");
    expect(workflow).not.toContain("acute-live-eval");
    expect(workflow).not.toContain("acute-classifier-smoke");
  });
});
