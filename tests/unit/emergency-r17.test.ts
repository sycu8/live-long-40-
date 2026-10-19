import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { ACUTE_CLASSIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import {
  evaluateHighRisk,
  hasExplicitFigurativeMarker,
  hasSelfHarmCue,
  ingestionIsDeliberateOrLarge,
  POST_SEIZURE_CHECK_LINE,
  refineClassifierRisk,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
} from "../../shared/rules/safety";
import {
  clearAcuteClassifierCache,
  type AcuteLayerResult,
} from "../../worker/ai/acute-classifier";
import { appendAcuteSafetyNet, runChatPipeline } from "../../worker/ai/pipeline";
import { chatRoutes } from "../../worker/api/chat";
import type { AppVariables, Env } from "../../worker/env";

const POISON = "Ông nuốt cả vỉ thuốc huyết áp";

function chatApp(options: {
  category?: string;
  intent?: boolean;
  verify?: boolean | "failed";
  fail?: AcuteLayerResult;
}) {
  const analytics: Array<Record<string, unknown>> = [];
  const env = {
    DB: {
      prepare(sql: string) {
        const statement = {
          async all() {
            return { results: [] };
          },
          async run() {
            return { success: true };
          },
          async first() {
            if (sql.includes("chat_sessions")) {
              return { id: "cs1", session_id: "sess-1", history_opt_in: 0 };
            }
            return null;
          },
          bind() {
            return statement;
          },
        };
        return statement;
      },
    },
    AI: {
      async run(_model: string, inputs?: { messages?: Array<{ content?: string }> }) {
        const system = inputs?.messages?.[0]?.content ?? "";
        if (system.includes("VERIFIER_IDIOM_JSON")) {
          if (options.verify === "failed") return "nope";
          return JSON.stringify({ crisis: options.verify !== false });
        }
        if (options.fail) return "not a verdict";
        return JSON.stringify({
          category: options.category ?? "poisoning",
          acute: true,
          intent_first_person: options.intent ?? false,
          figurative: false,
        });
      },
    },
    ANALYTICS_QUEUE: {
      async send(body: Record<string, unknown>) {
        analytics.push(body);
      },
    },
  } as unknown as Env;
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  app.use("*", async (c, next) => {
    c.set("sessionId", "sess-1");
    c.set("sessionPublicId", "ps-1");
    c.set("csrfToken", "csrf-1");
    c.set("requestId", "req-1");
    await next();
  });
  app.route("/", chatRoutes);
  return { app, env, analytics };
}

function deliveredSse(raw: string): string {
  let text = "";
  for (const block of raw.split("\n\n")) {
    const line = block.trim();
    if (!line.startsWith("data:")) continue;
    const payload = JSON.parse(line.slice(5).trim()) as {
      type?: string;
      text?: string;
      replace?: boolean;
    };
    if (payload.type !== "token" || !payload.text) continue;
    text = payload.replace ? payload.text : text + payload.text;
  }
  return text;
}

describe("emergency r17", () => {
  afterEach(() => {
    clearAcuteClassifierCache();
  });

  it("keeps the classifier prompt text and bumps the ruleset", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.9");
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).not.toContain(
      "Indirect first-person intent is self_harm even without",
    );
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).toContain("self_harm");
  });

  it("F10-R16b keeps distress, a negated subject, either/or, and a help request on the instant screen", () => {
    for (const question of [
      "Tôi muốn chết, không ai hiểu tôi",
      "Không ai muốn giúp, tôi muốn chết",
      "Tôi không lối thoát, muốn chết",
      "Tôi không chịu nổi nữa, muốn chết",
      "Tôi muốn chết hay muốn sống, hãy giúp tôi",
      "Tôi chưa muốn chết",
    ]) {
      expect(evaluateHighRisk(question).riskClass, question).toBe("self_harm");
    }
  });

  it("F10-R16a demotes chưa bao giờ and chưa từng, and bare chưa stays instant", () => {
    for (const question of [
      "Tôi chưa bao giờ muốn tự tử",
      "Tôi chưa từng nghĩ đến tự tử",
    ]) {
      expect(evaluateHighRisk(question).riskClass, question).not.toBe("self_harm");
      expect(hasSelfHarmCue(question), question).toBe(true);
    }
    expect(evaluateHighRisk("Tôi chưa muốn chết").riskClass).toBe("self_harm");
  });

  it("F10-R16b masked path treats verifier failure as crisis and a refusal runs the verifier", async () => {
    const denied = "Tôi không hề có ý định tự tử";
    expect(evaluateHighRisk(denied).riskClass).not.toBe("self_harm");
    let verifies = 0;
    const failed = await runChatPipeline({} as Env, denied, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: {
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: false,
        },
      }),
      verifyCrisis: async () => {
        verifies += 1;
        return "failed";
      },
    });
    expect(failed.kind).toBe("high_risk");
    if (failed.kind !== "high_risk") return;
    expect((await failed.upgrade)?.riskClass).toBe("self_harm");
    expect(verifies).toBe(1);

    verifies = 0;
    const refused = await runChatPipeline({} as Env, denied, {
      classifyAcute: async () => ({ status: "fail", reason: "parse" }),
      verifyCrisis: async () => {
        verifies += 1;
        return true;
      },
    });
    expect(refused.kind).toBe("high_risk");
    if (refused.kind !== "high_risk") return;
    expect((await refused.upgrade)?.riskClass).toBe("self_harm");
    expect(verifies).toBe(1);

    const cleanNo = await runChatPipeline({} as Env, denied, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: {
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: false,
        },
      }),
      verifyCrisis: async () => false,
    });
    expect(cleanNo.kind).toBe("high_risk");
    if (cleanNo.kind !== "high_risk") return;
    expect(await cleanNo.upgrade).toBeNull();
  });

  it("F1 runs the verifier on an unreadable classifier and cues a passive wish", async () => {
    const passive = "Em mong một giấc không bao giờ thức dậy";
    expect(evaluateHighRisk(passive).matched).toBe(false);
    expect(hasSelfHarmCue(passive)).toBe(true);
    const confirmed = await runChatPipeline({} as Env, passive, {
      classifyAcute: async () => ({ status: "fail", reason: "parse" }),
      verifyCrisis: async () => true,
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind === "high_risk") {
      expect(confirmed.riskClass).toBe("self_harm");
      expect(confirmed.message).not.toContain("1900");
    }
    const failSafe = await runChatPipeline({} as Env, passive, {
      classifyAcute: async () => ({ status: "fail", reason: "empty" }),
      verifyCrisis: async () => "failed",
    });
    expect(failSafe.kind).toBe("high_risk");
    if (failSafe.kind === "high_risk") expect(failSafe.riskClass).toBe("self_harm");
  });

  it("F2 verifies a deliberate or large ingestion and composes crisis first on yes", async () => {
    expect(ingestionIsDeliberateOrLarge(POISON)).toBe(true);
    expect(evaluateHighRisk(POISON).riskClass).toBe("poisoning");
    let verifies = 0;
    const confirmed = await runChatPipeline({} as Env, POISON, {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: {
          category: "poisoning",
          acute: true,
          intent_first_person: false,
          figurative: false,
        },
      }),
      verifyCrisis: async () => {
        verifies += 1;
        return true;
      },
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind !== "high_risk") return;
    expect(confirmed.riskClass).toBe("poisoning");
    const upgraded = await confirmed.upgrade;
    expect(verifies).toBe(1);
    expect(upgraded?.riskClass).toBe("self_harm");
    expect(upgraded?.finalMessage?.indexOf("Ở lại bên cạnh")).toBeLessThan(
      upgraded?.finalMessage?.indexOf("Không tự gây nôn") ?? -1,
    );

    const deliberate = "Tôi cố ý uống thuốc chuột";
    expect(evaluateHighRisk(deliberate).riskClass).toBe("poisoning");
    let intentChecks = 0;
    const byIntent = await runChatPipeline({} as Env, "Em nuốt thuốc hồi nãy", {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: {
          category: "poisoning",
          acute: true,
          intent_first_person: true,
          figurative: false,
        },
      }),
      verifyCrisis: async () => {
        intentChecks += 1;
        return true;
      },
    });
    expect(intentChecks).toBe(1);
    expect(byIntent.kind).toBe("high_risk");
    if (byIntent.kind !== "high_risk") return;
    expect(byIntent.message.indexOf("Ở lại bên cạnh")).toBeLessThan(
      byIntent.message.indexOf("Không tự gây nôn"),
    );
  });

  it("F10 residual keeps a third-person intensifier off the rule screen and a confirmed crisis on the crisis screen", async () => {
    const idiom = "Nó khóc muốn chết vì bộ phim";
    expect(hasExplicitFigurativeMarker(idiom)).toBe(true);
    expect(evaluateHighRisk(idiom).riskClass).not.toBe("self_harm");
    const confirmed = await runChatPipeline({} as Env, "Tôi muốn chết đêm nay", {
      classifyAcute: async () => ({
        status: "ok",
        cached: false,
        verdict: {
          category: "self_harm",
          acute: true,
          intent_first_person: true,
          figurative: true,
        },
      }),
      verifyCrisis: async () => true,
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind === "high_risk") expect(confirmed.riskClass).toBe("self_harm");
  });

  it("F8 ranks a named symptom over choking and unconscious, and chest over breathing", () => {
    expect(evaluateHighRisk("Ông đau thắt ngực và không thở được").riskClass).toBe(
      "chest_pain",
    );
    expect(evaluateHighRisk("Ông bị hóc và đau thắt ngực").riskClass).toBe("chest_pain");
    expect(evaluateHighRisk("Bà méo miệng rồi bất tỉnh").riskClass).toBe("stroke");
    expect(evaluateHighRisk("Nhà có thuốc chuột").matched).toBe(false);
    expect(refineClassifierRisk("Nhà có thuốc chuột", "poisoning")).toBeNull();
    expect(refineClassifierRisk("Ông kêu tức ngực kèm vã mồ hôi", "breathing")).toBe(
      "chest_pain",
    );
    expect(refineClassifierRisk("Hôm nay trời đẹp quá", "seizure")).toBe("seizure");
  });

  it("F12 gives a finished first seizure the calm line", () => {
    const over = "Bé lên cơn co giật lần đầu, giờ đã hết rồi";
    expect(seizureLooksResolved(over)).toBe(true);
    expect(evaluateHighRisk(over).riskClass).not.toBe("seizure");
    const text = appendAcuteSafetyNet(over, "Theo dõi thêm.", null, true);
    expect(text).toContain(POST_SEIZURE_CHECK_LINE);
    expect(text).toContain("115");
    expect(text).not.toContain("Không nhét");
    expect(
      evaluateHighRisk("Bé lên cơn co giật lần đầu, đã hết nhưng chưa tỉnh").riskClass,
    ).toBe("seizure");
  });

  it("F5 drops a negated or figurative chest or seizure class", () => {
    expect(evaluateHighRisk("Không phải co giật").matched).toBe(false);
    expect(evaluateHighRisk("Tôi không bị đau ngực").matched).toBe(false);
    expect(refineClassifierRisk("Tôi không bị đau ngực", "chest_pain")).toBeNull();
    expect(refineClassifierRisk("Bé không hề co giật", "seizure")).toBeNull();
    expect(
      refineClassifierRisk("Đau vai muốn chết khi nằm nghiêng", "chest_pain"),
    ).toBeNull();
  });

  it("F2-ORD puts the crisis block first on SSE and on JSON", async () => {
    clearAcuteClassifierCache();
    const stream = chatApp({ verify: true });
    const response = await stream.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: POISON }),
      },
      stream.env,
    );
    const raw = await response.text();
    const shown = deliveredSse(raw);
    expect(raw).toContain('"replace":true');
    expect(shown.indexOf("Ở lại bên cạnh")).toBeLessThan(
      shown.indexOf("Không tự gây nôn"),
    );

    clearAcuteClassifierCache();
    const json = chatApp({ verify: true });
    const jsonResponse = await json.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: POISON }),
      },
      json.env,
    );
    const body = (await jsonResponse.json()) as { riskClass: string; content: string };
    expect(body.riskClass).toBe("self_harm");
    expect(body.content.indexOf("Ở lại bên cạnh")).toBeLessThan(
      body.content.indexOf("Không tự gây nôn"),
    );
    expect(body.content).not.toContain("1900");
  });
});
