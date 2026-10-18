import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACUTE_CLASSIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  SYMPTOM_SAFETY_LINE,
} from "../../shared/rules/safety";
import {
  ACUTE_CLASSIFIER_TIMEOUT_MS,
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
    expect(result.message).toContain("1900 1267");
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
    expect(performance.now() - started).toBeLessThan(800);
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
    expect(ACUTE_CLASSIFIER_TIMEOUT_MS).toBeLessThanOrEqual(2500);
  });

  it("fails immediately when Workers AI is not bound", async () => {
    const result = await classifyAcuteRisk({} as Env, "Ngủ đủ bảy giờ có tốt không?");
    expect(result).toEqual({ status: "fail", reason: "unavailable" });
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
    });
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("self_harm");
    expect(result.message).toContain("1900 1267");
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

  it("leaves the live eval script out of CI", () => {
    const pkg = readFileSync("package.json", "utf8");
    const workflow = readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
    expect(pkg).not.toContain("acute-live-eval");
    expect(workflow).not.toContain("acute-live-eval");
  });
});
