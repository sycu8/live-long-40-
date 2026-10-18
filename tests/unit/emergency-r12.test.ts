import { describe, expect, it } from "vitest";
import { mayUpgrade } from "../../shared/rules/precedence";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
} from "../../shared/rules/safety";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

const crisisVerdict = {
  status: "ok" as const,
  cached: false,
  verdict: {
    category: "self_harm" as const,
    acute: true,
    intent_first_person: true,
    figurative: false,
  },
};

describe("emergency precedence r12", () => {
  it("is ruleset v1.8.5", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.5");
  });

  it("F15 shows the rule screen immediately, including under a classifier stall", async () => {
    let calls = 0;
    const started = performance.now();
    const result = await runChatPipeline(
      {
        AI: {
          async run() {
            calls += 1;
            return new Promise(() => undefined);
          },
        },
      } as unknown as Env,
      "Ông tôi bị nhói ngực dữ dội",
      { classifierTimeoutMs: 30 },
    );
    expect(performance.now() - started).toBeLessThan(100);
    expect(calls).toBe(0);
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("chest_pain");
    expect(result.upgrade).toBeUndefined();
  });

  it("upgrades unconscious to the crisis screen only after verifier yes", async () => {
    const question = "Mẹ tôi lịm đi, không phản ứng gì cả";
    expect(evaluateHighRisk(question).riskClass).toBe("unconscious");
    let calls = 0;
    const started = performance.now();
    const stalled = await runChatPipeline(
      {
        AI: {
          async run() {
            calls += 1;
            return new Promise(() => undefined);
          },
        },
      } as unknown as Env,
      question,
      { classifierTimeoutMs: 40 },
    );
    expect(performance.now() - started).toBeLessThan(100);
    expect(stalled.kind).toBe("high_risk");
    if (stalled.kind !== "high_risk") return;
    expect(stalled.riskClass).toBe("unconscious");
    expect(stalled.message).toMatch(/gọi 115/i);

    const upgraded = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => {
        calls += 1;
        return crisisVerdict;
      },
      verifyCrisis: async () => true,
    });
    expect(upgraded.kind).toBe("high_risk");
    if (upgraded.kind !== "high_risk" || !upgraded.upgrade) return;
    expect(upgraded.riskClass).toBe("unconscious");
    const later = await upgraded.upgrade;
    expect(later?.riskClass).toBe("self_harm");
    expect(later?.message).toMatch(/gọi 115/i);
    expect(later?.message).not.toContain("1900");

    const declined = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => crisisVerdict,
      verifyCrisis: async () => false,
    });
    expect(declined.kind).toBe("high_risk");
    if (declined.kind === "high_risk" && declined.upgrade) {
      expect(await declined.upgrade).toBeNull();
    }
    expect(calls).toBeGreaterThan(0);
  });

  it("F19 keeps a direct denial calm and a distress phrase on the crisis screen", () => {
    for (const question of [
      "Tôi không muốn tự tử",
      "Tôi không còn muốn tự tử",
      "Em không định tự tử",
    ]) {
      expect(evaluateHighRisk(question).riskClass, question).not.toBe("self_harm");
    }
    for (const [id, question] of [
      ["distress-song", "Tôi không muốn sống nữa"],
      ["distress-thiet", "Em không thiết sống nữa"],
      ["distress-chiu", "Mình không chịu nổi nữa"],
      ["khong-con-suc", "Tôi không còn sức chịu đựng, muốn chết"],
      ["chua", "Tôi chưa muốn chết"],
      ["ambivalence", "Em không biết nên sống hay chết"],
    ] as const) {
      expect(evaluateHighRisk(question).riskClass, id).toBe("self_harm");
      expect(evaluateHighRisk(question).message, id).toMatch(/gọi 115/i);
      expect(evaluateHighRisk(question).message, id).not.toContain("1900");
    }
  });

  it("F2 lets self-harm intent outrank ingestion and adds the poisoning caution", () => {
    for (const [id, question] of [
      ["v6-002", "Em muốn chết nên uống hết vỉ thuốc"],
      ["v6-008", "Tôi không muốn sống nữa và đã uống thuốc chuột"],
      ["v5-040", "Mình định nuốt cả vỉ vì không thiết sống"],
    ] as const) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, id).toBe("self_harm");
      expect(result.message, id).toMatch(/gọi 115/i);
      expect(result.message, id).toContain("Không tự gây nôn");
      expect(result.message, id).not.toContain("1900");
    }
    expect(evaluateHighRisk("Ông tôi uống nhầm thuốc").riskClass).toBe("poisoning");
  });

  it("F20 keeps a dangerous stopped seizure on the acute route", () => {
    expect(seizureLooksResolved("Bé hết co giật rồi")).toBe(true);
    expect(evaluateHighRisk("Bé hết co giật rồi").matched).toBe(false);
    for (const [id, question] of [
      ["again", "Bé hết co giật rồi lại co giật"],
      ["awake", "Hết co giật nhưng chưa tỉnh"],
      ["long", "Co giật đã qua nhưng kéo dài hơn 5 phút"],
      ["pregnant", "Cô ấy hết co giật, đang mang thai"],
      ["injury", "Hết co giật, đập đầu chảy máu"],
      ["breathing", "Hết co giật nhưng khó thở"],
    ] as const) {
      expect(seizureLooksResolved(question), id).toBe(false);
      const result = evaluateHighRisk(question);
      expect(result.matched, id).toBe(true);
      expect(result.message, id).not.toContain("Cơn co giật đã qua");
      expect(result.message, id).toMatch(/gọi 115/i);
    }
  });

  it("F7 keeps the gentle line on a pending abstain and in the follow-up", async () => {
    let release: (value: { status: "fail"; reason: "timeout" }) => void = () => undefined;
    const gate = new Promise<{ status: "fail"; reason: "timeout" }>((resolve) => {
      release = resolve;
    });
    const result = await runChatPipeline({} as Env, "Vitamin C nên uống lúc nào?", {
      classifyAcute: () => gate,
    });
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).toMatch(/115/);
    release({ status: "fail", reason: "timeout" });
    const extra = result.followUp ? (await result.followUp).extra : "";
    const text = `${result.message}${extra}`;
    expect(text).toContain(GENTLE_SUPPORT_LINE);
    expect(text.split(GENTLE_SUPPORT_LINE).length - 1).toBe(1);
    expect(text).not.toContain("Nên làm");
    expect(text).not.toContain("1900");
  });

  it("F18 shows the crisis screen when the verifier output is unreadable", () => {
    const rules = {
      class: null,
      acuteCue: false,
      selfHarmLexicon: false,
      firstPersonHarmIntent: false,
      pastStable: false,
      cues: [],
    };
    expect(
      mayUpgrade(
        { ...rules, class: "unconscious" },
        { class: "self_harm", crisis: true, verified: true },
      ),
    ).toEqual({ kind: "screen", riskClass: "self_harm" });
    expect(
      mayUpgrade(
        { ...rules, class: "unconscious" },
        { class: "self_harm", crisis: true, verified: "failed" },
      ),
    ).toBeNull();
  });
});
