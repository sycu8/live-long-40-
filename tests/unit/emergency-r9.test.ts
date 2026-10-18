import { describe, expect, it } from "vitest";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  hasAcuteCue,
  hasExplicitFigurativeMarker,
  POST_SEIZURE_CHECK_LINE,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
  selfHarmLooksPastStable,
} from "../../shared/rules/safety";
import { ACUTE_CLASSIFIER_TIMEOUT_MS } from "../../worker/ai/acute-classifier";
import { resolveAcuteScreen, runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

const figurativeIntent = {
  status: "ok" as const,
  cached: false,
  verdict: {
    category: "self_harm" as const,
    acute: true,
    intent_first_person: true,
    figurative: true,
  },
};

describe("emergency rules r9", () => {
  it("bumps the ruleset to v1.8.3", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.3");
    expect(ACUTE_CLASSIFIER_TIMEOUT_MS).toBe(3500);
  });

  it("accepts figurative only when the text has an idiom", () => {
    expect(hasExplicitFigurativeMarker("Mệt muốn chết sau ca trực")).toBe(true);
    expect(hasExplicitFigurativeMarker("Cười muốn chết với video mèo")).toBe(true);
    expect(hasExplicitFigurativeMarker("Nóng muốn chết, bật quạt thêm")).toBe(true);
    expect(hasExplicitFigurativeMarker("Tôi muốn chết đêm nay")).toBe(false);

    const literal = "Em tính kết thúc cuộc đời";
    expect(evaluateHighRisk(literal).riskClass).toBe("self_harm");
    expect(hasExplicitFigurativeMarker(literal)).toBe(false);
    expect(resolveAcuteScreen(literal, figurativeIntent)).toBe("self_harm");

    const idiom = "Mệt muốn chết sau ca trực";
    expect(evaluateHighRisk(idiom).matched).toBe(false);
    expect(resolveAcuteScreen(idiom, figurativeIntent)).toBeNull();
  });

  it("lets intent plus a method outrank poisoning and unconscious", () => {
    for (const question of [
      "Anh ấy nhảy lầu để chết",
      "Cô ấy uống thuốc độc cho chết",
      "Em định treo cổ tối nay",
    ]) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, question).toBe("self_harm");
      expect(result.message, question).toMatch(/gọi 115/i);
      expect(result.message, question).not.toContain("1900");
      expect(
        resolveAcuteScreen(question, {
          status: "ok",
          cached: false,
          verdict: {
            category: "poisoning",
            acute: true,
            intent_first_person: false,
            figurative: false,
          },
        }),
      ).toBe("self_harm");
    }
    expect(evaluateHighRisk("Ông tôi uống nhầm thuốc diệt chuột").riskClass).toBe(
      "poisoning",
    );
  });

  it("keeps information, third person, past, hypotheticals, and negation off the crisis screen", () => {
    for (const question of [
      "Dấu hiệu đau ngực gồm những gì?",
      "Đau thắt ngực là bệnh gì?",
      "Cháu để lại lời trăng trối",
      "Nếu tôi muốn tự tử thì phải làm gì?",
      "Nếu bị đau ngực thì có sao không?",
      "Tôi không bị đau ngực",
      "Bé không co giật",
      "Trước kia tôi muốn chết, giờ thì ổn",
    ]) {
      const result = evaluateHighRisk(question);
      expect(result.matched, question).toBe(false);
      expect(result.message, question).not.toContain("Nên làm");
    }
    expect(evaluateHighRisk("Bố tôi đau tức ngực và vã mồ hôi").riskClass).toBe(
      "chest_pain",
    );
  });

  it("gives resolved past thoughts the gentle 115 line even when the classifier says figurative", async () => {
    const question = "Trước kia tôi muốn chết, giờ thì ổn";
    expect(selfHarmLooksPastStable(question)).toBe(true);
    const result = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => figurativeIntent,
    });
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).toMatch(/115/);
    expect(result.message).not.toContain("Nên làm");
    expect(result.message).not.toContain("1900");
  });

  it("shows the generic urgent screen on timeout when an acute cue is present", () => {
    const acute = "Tim đập loạn, đổ mồ hôi lạnh, không dám cử động";
    expect(evaluateHighRisk(acute).matched).toBe(false);
    expect(hasAcuteCue(acute)).toBe(true);
    expect(resolveAcuteScreen(acute, { status: "fail", reason: "timeout" })).toBe(
      "urgent",
    );

    const calm = "Vitamin C nên uống lúc nào?";
    expect(hasAcuteCue(calm)).toBe(false);
    expect(resolveAcuteScreen(calm, { status: "fail", reason: "timeout" })).toBeNull();
  });

  it("keeps the chest screen when the classifier names poisoning", () => {
    const question = "Bố tôi đau tức ngực và vã mồ hôi";
    expect(evaluateHighRisk(question).riskClass).toBe("chest_pain");
    expect(
      resolveAcuteScreen(question, {
        status: "ok",
        cached: false,
        verdict: {
          category: "poisoning",
          acute: true,
          intent_first_person: false,
          figurative: false,
        },
      }),
    ).toBe("chest_pain");
    expect(
      resolveAcuteScreen(question, {
        status: "ok",
        cached: false,
        verdict: {
          category: "chest",
          acute: true,
          intent_first_person: false,
          figurative: false,
        },
      }),
    ).toBe("chest_pain");
  });

  it("treats a stopped seizure in any order as a check, not the panic screen", async () => {
    for (const question of ["Co giật xong rồi", "Đã hết co giật", "Bé hết co giật rồi"]) {
      expect(seizureLooksResolved(question), question).toBe(true);
      expect(evaluateHighRisk(question).matched, question).toBe(false);
      const result = await runChatPipeline({} as Env, question);
      expect(result.kind, question).toBe("abstain");
      if (result.kind !== "abstain") return;
      expect(result.message, question).toContain(POST_SEIZURE_CHECK_LINE);
      expect(result.message, question).not.toContain("Nên làm:");
    }
    expect(evaluateHighRisk("Hết đau, bé co giật").riskClass).toBe("seizure");
    expect(evaluateHighRisk("Cháu đang giật không ngừng").riskClass).toBe("seizure");
  });
});
