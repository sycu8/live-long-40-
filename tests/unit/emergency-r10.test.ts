import { describe, expect, it } from "vitest";
import {
  decide,
  type ClassifierView,
  type Decision,
  type RuleView,
} from "../../shared/rules/precedence";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
} from "../../shared/rules/safety";
import { parseCrisisVerifierOutput } from "../../worker/ai/acute-classifier";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

/**
 * QA ids from r9 and r10. The hold-out wording is private, so each id is the
 * decision its class must take. Sentences below are original class examples.
 */
function rules(partial: Partial<RuleView> = {}): RuleView {
  return {
    class: null,
    acuteCue: false,
    selfHarmLexicon: false,
    firstPersonHarmIntent: false,
    pastStable: false,
    cues: [],
    ...partial,
  };
}

function crisis(verified?: boolean | "failed"): ClassifierView {
  return verified === undefined
    ? { class: "self_harm", crisis: true }
    : { class: "self_harm", crisis: true, verified };
}

const screen = (
  riskClass: Decision extends { kind: "screen"; riskClass: infer R } ? R : never,
): Decision => ({
  kind: "screen",
  riskClass,
});

const TABLE: Array<{
  id: string;
  rules: RuleView;
  classifier: ClassifierView;
  timeout: boolean;
  expect: Decision;
}> = [
  {
    id: "F15",
    rules: rules({ class: "chest_pain", acuteCue: true, cues: ["chest_pain"] }),
    classifier: null,
    timeout: false,
    expect: screen("chest_pain"),
  },
  {
    id: "F16",
    rules: rules({ class: "chest_pain", acuteCue: true, cues: ["chest_pain"] }),
    classifier: { class: "poisoning", crisis: false },
    timeout: false,
    expect: screen("chest_pain"),
  },
  {
    id: "v6-002",
    rules: rules({ class: "poisoning", cues: ["poisoning"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("poisoning"),
  },
  {
    id: "v6-008",
    rules: rules({ class: "poisoning", cues: ["poisoning"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("poisoning"),
  },
  {
    id: "v5-040",
    rules: rules({ class: "unconscious", cues: ["unconscious"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("unconscious"),
  },
  {
    id: "v5-002",
    rules: rules({ class: "poisoning", cues: ["poisoning"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("poisoning"),
  },
  {
    id: "ll-002",
    rules: rules({ class: "unconscious", cues: ["unconscious"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("unconscious"),
  },
  {
    id: "v5-031",
    rules: rules({ class: "poisoning", cues: ["poisoning"] }),
    classifier: crisis(),
    timeout: false,
    expect: screen("poisoning"),
  },
  {
    id: "v7-024",
    rules: rules(),
    classifier: crisis(false),
    timeout: false,
    expect: { kind: "gentle" },
  },
  ...["v7-026", "v7-031", "v6-056", "v6-060", "v5-054", "ll-041", "ll-050", "N4"].map(
    (id) => ({
      id,
      rules: rules(),
      classifier: crisis(),
      timeout: false,
      expect: { kind: "verify" } as Decision,
    }),
  ),
  {
    id: "F10-confirmed",
    rules: rules(),
    classifier: crisis(true),
    timeout: false,
    expect: screen("self_harm"),
  },
  {
    id: "F1-cue",
    rules: rules({ firstPersonHarmIntent: true, selfHarmLexicon: true }),
    classifier: crisis(),
    timeout: false,
    expect: screen("self_harm"),
  },
  {
    id: "F7",
    rules: rules({ acuteCue: true }),
    classifier: null,
    timeout: true,
    expect: screen("urgent"),
  },
  {
    id: "F12",
    rules: rules(),
    classifier: null,
    timeout: true,
    expect: { kind: "gentle" },
  },
  {
    id: "v7-018",
    rules: rules(),
    classifier: null,
    timeout: true,
    expect: { kind: "gentle" },
  },
  {
    id: "N13",
    rules: rules(),
    classifier: null,
    timeout: true,
    expect: { kind: "gentle" },
  },
  {
    id: "N14",
    rules: rules(),
    classifier: null,
    timeout: true,
    expect: { kind: "gentle" },
  },
  {
    id: "F14",
    rules: rules({ pastStable: true }),
    classifier: crisis(),
    timeout: false,
    expect: { kind: "gentle" },
  },
  {
    id: "F8",
    rules: rules({ class: "breathing", cues: ["breathing"] }),
    classifier: { class: "poisoning", crisis: false },
    timeout: false,
    expect: screen("breathing"),
  },
  {
    id: "upgrade-seizure",
    rules: rules({ class: "poisoning", cues: ["poisoning", "seizure"] }),
    classifier: { class: "seizure", crisis: false },
    timeout: false,
    expect: screen("poisoning"),
  },
  {
    id: "upgrade-self-harm",
    rules: rules({
      class: "poisoning",
      selfHarmLexicon: true,
      cues: ["poisoning", "self_harm"],
    }),
    classifier: crisis(),
    timeout: false,
    expect: screen("poisoning"),
  },
  ...(["timeout", "parse", "empty", "unavailable", "unsupported"] as const).flatMap(
    (reason) => [
      {
        id: `F17-${reason}-rule`,
        rules: rules({ class: "chest_pain" as const, cues: ["chest_pain" as const] }),
        classifier: null,
        timeout: true,
        expect: screen("chest_pain"),
      },
      {
        id: `F17-${reason}-cue`,
        rules: rules({ acuteCue: true }),
        classifier: null,
        timeout: true,
        expect: screen("urgent"),
      },
      {
        id: `F17-${reason}-calm`,
        rules: rules(),
        classifier: null,
        timeout: true,
        expect: { kind: "gentle" } as Decision,
      },
    ],
  ),
  {
    id: "F18",
    rules: rules(),
    classifier: crisis("failed"),
    timeout: false,
    expect: screen("self_harm"),
  },
  {
    id: "F18-cue",
    rules: rules({ acuteCue: true }),
    classifier: crisis("failed"),
    timeout: false,
    expect: screen("self_harm"),
  },
];

const crisisVerdict = {
  status: "ok" as const,
  cached: false,
  verdict: {
    category: "self_harm" as const,
    acute: true,
    intent_first_person: false,
    figurative: true,
  },
};

describe("emergency precedence r10", () => {
  it("is ruleset v1.8.7", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.7");
  });

  it("follows the precedence table for every r9 and r10 id", () => {
    for (const row of TABLE) {
      expect(decide(row.rules, row.classifier, row.timeout), row.id).toEqual(row.expect);
    }
  });

  it("catches an ending-life plan as self-harm and leaves a task or a definition alone", () => {
    for (const [id, question] of [
      ["v7-002", "Em tính kết thúc cuộc đời"],
      ["v7-004", "Tôi sẽ kết liễu"],
      ["v7-005", "Mình định giết mình đêm nay"],
      ["v6-004", "Em tính kết thúc cuộc sống"],
    ] as const) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, id).toBe("self_harm");
      expect(result.message, id).toMatch(/gọi 115/i);
      expect(result.message, id).not.toContain("1900");
    }
    expect(evaluateHighRisk("Em tính kết thúc bài tập").matched).toBe(false);
    expect(evaluateHighRisk("Kết liễu cuộc đời là gì?").matched).toBe(false);
  });

  it("keeps negation, chest information, and a stopped seizure off the panic screen", () => {
    expect(evaluateHighRisk("Bé không bị đau ngực").matched).toBe(false);
    expect(evaluateHighRisk("Dấu hiệu đau ngực gồm những gì?").matched).toBe(false);
    expect(evaluateHighRisk("Đau thắt ngực là bệnh gì?").matched).toBe(false);
    expect(seizureLooksResolved("Co giật xong rồi")).toBe(true);
    expect(evaluateHighRisk("Co giật xong rồi").matched).toBe(false);
    expect(evaluateHighRisk("Đã hết co giật").matched).toBe(false);
  });

  it("shows a chest screen before the classifier, including when that call would stall", async () => {
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
    );
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("chest_pain");
    expect(result.message).toMatch(/gọi 115/i);
    expect(calls).toBe(0);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("uses urgent on a timed-out acute cue and the gentle line when there is no cue", async () => {
    const acute = await runChatPipeline(
      {} as Env,
      "Tim đập loạn, đổ mồ hôi lạnh, không dám cử động",
      {
        classifyAcute: async () => ({ status: "fail", reason: "timeout" }),
      },
    );
    expect(acute.kind).toBe("high_risk");
    if (acute.kind === "high_risk") {
      expect(acute.riskClass).toBe("urgent");
      expect(acute.message).toMatch(/gọi 115/i);
      expect(acute.message).not.toContain("1900");
    }

    const calm = await runChatPipeline({} as Env, "Vitamin C nên uống lúc nào?", {
      classifyAcute: async () => ({ status: "fail", reason: "timeout" }),
    });
    expect(calm.kind).toBe("abstain");
    if (calm.kind !== "abstain") return;
    const extra = calm.followUp ? (await calm.followUp).extra : "";
    const text = `${calm.message}${extra}`;
    expect(text).toContain(GENTLE_SUPPORT_LINE);
    expect(text).toMatch(/115/);
    expect(text).not.toContain("Nên làm");
    expect(text).not.toContain("1900");
  });

  it("asks the idiom verifier before a crisis screen with no first-person cue", async () => {
    const vent = "Hôm nay chán quá, muốn kể cho ai đó nghe";
    expect(evaluateHighRisk(vent).matched).toBe(false);
    const declined = await runChatPipeline({} as Env, vent, {
      classifyAcute: async () => crisisVerdict,
      verifyCrisis: async () => false,
    });
    expect(declined.kind).toBe("abstain");
    if (declined.kind !== "abstain") return;
    const extra = declined.followUp ? (await declined.followUp).extra : "";
    const text = `${declined.message}${extra}`;
    expect(text).toContain(GENTLE_SUPPORT_LINE);
    expect(text).not.toContain("Nên làm");

    const confirmed = await runChatPipeline({} as Env, vent, {
      classifyAcute: async () => crisisVerdict,
      verifyCrisis: async () => true,
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind === "high_risk") {
      expect(confirmed.riskClass).toBe("self_harm");
      expect(confirmed.message).toMatch(/gọi 115/i);
      expect(confirmed.message).not.toContain("1900");
    }
  });

  it("reads a verifier object and treats a bad one as unconfirmed", () => {
    expect(parseCrisisVerifierOutput('{"crisis":true}')).toBe(true);
    expect(parseCrisisVerifierOutput('{"crisis":false}')).toBe(false);
    expect(parseCrisisVerifierOutput("not json")).toBeNull();
  });
});
