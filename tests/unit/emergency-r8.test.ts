import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACUTE_CLASSIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  POST_SEIZURE_CHECK_LINE,
  refineClassifierRisk,
  SAFETY_RULESET_VERSION,
  selfHarmLooksPastStable,
  seizureLooksResolved,
  SYMPTOM_SAFETY_LINE,
} from "../../shared/rules/safety";
import { alertFromClassifierLayer, runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

describe("emergency rules r8", () => {
  it("bumps the ruleset", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.3");
  });

  it("routes intent, a plan, a means, and a farewell as self-harm", () => {
    for (const question of [
      "Em định chết tối nay",
      "Em sẽ chết đêm nay",
      "Em không sống nổi nữa",
      "Tôi không còn sống nổi",
      "Tôi viết thư vĩnh biệt cuộc đời",
      "Tôi để lại lời trăng trối",
    ]) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, question).toBe("self_harm");
      expect(result.message, question).toMatch(/gọi 115/i);
      expect(result.message, question).toContain("Nên làm:");
    }
  });

  it("lets a real intent outrank chest pain, poisoning, and unconscious", () => {
    const chest = "Tôi muốn chết và ngực đau dữ";
    expect(evaluateHighRisk(chest).riskClass).toBe("self_harm");
    expect(refineClassifierRisk(chest, "chest_pain")).toBe("self_harm");

    const poison = "Em định uống thuốc chuột rồi ngất";
    expect(evaluateHighRisk(poison).riskClass).toBe("self_harm");
    expect(refineClassifierRisk(poison, "poisoning")).toBe("self_harm");
    expect(refineClassifierRisk(poison, "unconscious")).toBe("self_harm");

    expect(evaluateHighRisk("ong toi uong thuoc diet chuot").riskClass).toBe("poisoning");
    expect(evaluateHighRisk("Cháu uống nhầm nước tẩy").riskClass).toBe("poisoning");
  });

  it("keeps resolved thoughts, denials, and idioms off the crisis screen", async () => {
    for (const question of [
      "Tôi giận muốn chết",
      "Đau vai muốn chết khi nằm nghiêng",
      "Tôi không muốn tự tử",
      "Ông sẽ chết vì bệnh này",
      "Em viết thư từ biệt rồi cài then cửa",
    ]) {
      expect(evaluateHighRisk(question).riskClass, question).not.toBe("self_harm");
      expect(evaluateHighRisk(question).message, question).not.toContain("Nên làm:");
    }

    const idiomChest = evaluateHighRisk("Đau ngực muốn chết");
    expect(idiomChest.riskClass).toBe("chest_pain");
    expect(idiomChest.message).not.toContain("ý định tự làm hại");

    const past = "Trước kia em định chết, giờ thì ổn";
    expect(selfHarmLooksPastStable(past)).toBe(true);
    expect(evaluateHighRisk(past).matched).toBe(false);
    const result = await runChatPipeline({} as Env, past);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).toMatch(/115/);
    expect(result.message).not.toContain("Nên làm");
    expect(result.message).not.toContain("1900");
  });

  it("treats a stopped seizure as resolved in either word order", async () => {
    for (const question of [
      "Bé hết co giật rồi",
      "Cơn co giật đã hết",
      "Đã hết cơn co giật",
      "Co giật hết rồi",
      "Cơn co giật, đã hết",
    ]) {
      expect(seizureLooksResolved(question), question).toBe(true);
      expect(evaluateHighRisk(question).matched, question).toBe(false);
      const result = await runChatPipeline({} as Env, question);
      expect(result.kind, question).toBe("abstain");
      if (result.kind !== "abstain") return;
      expect(result.message, question).toContain(POST_SEIZURE_CHECK_LINE);
      expect(result.message, question).toContain("đi bệnh viện");
      expect(result.message, question).toContain("được kiểm tra");
      expect(result.message, question).toMatch(/gọi\s+115/i);
      expect(result.message, question).not.toContain("Nên làm:");
    }

    expect(seizureLooksResolved("Hết đau, bé co giật")).toBe(false);
    expect(evaluateHighRisk("Hết đau, bé co giật").riskClass).toBe("seizure");
    expect(evaluateHighRisk("Cháu đang giật không ngừng").riskClass).toBe("seizure");
    expect(evaluateHighRisk("Hết đau ngực rồi").matched).toBe(false);
    expect(seizureLooksResolved("Hết đau ngực rồi")).toBe(false);
  });

  it("names 115 and no other hotline on the screens or in the prompt", () => {
    expect(GENTLE_SUPPORT_LINE).toContain("115");
    expect(GENTLE_SUPPORT_LINE).not.toMatch(/1900|1267|1800/);
    expect(POST_SEIZURE_CHECK_LINE).toMatch(/gọi 115/i);
    expect(SYMPTOM_SAFETY_LINE).toMatch(/gọi ngay 115/);

    const sources = [
      readFileSync("shared/rules/safety.ts", "utf8"),
      readFileSync("shared/rules/acute-classifier-prompt.ts", "utf8"),
      readFileSync("worker/ai/pipeline.ts", "utf8"),
    ];
    for (const source of sources) {
      expect(source).not.toMatch(/1900|1267/);
      expect(source).not.toMatch(/\b113\b|\b114\b|\b1800\b/);
    }
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).toContain("115");
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).toContain("self_harm");
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).toContain("co giật đã hết");
  });

  it("falls back to the rules screen on every classifier failure", () => {
    const question = "Em định chết tối nay";
    for (const reason of ["timeout", "parse", "empty", "unavailable"] as const) {
      expect(alertFromClassifierLayer(question, { status: "fail", reason }), reason).toBe(
        "self_harm",
      );
    }
    expect(
      alertFromClassifierLayer("Vitamin C nên uống lúc nào?", {
        status: "fail",
        reason: "timeout",
      }),
    ).toBeNull();
  });
});
