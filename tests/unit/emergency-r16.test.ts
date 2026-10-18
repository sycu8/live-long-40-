import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACUTE_CLASSIFIER_SYSTEM_PROMPT,
  ACUTE_VERIFIER_SYSTEM_PROMPT,
} from "../../shared/rules/acute-classifier-prompt";
import {
  evaluateHighRisk,
  hasSelfHarmCue,
  hasSelfHarmLexicon,
  refineClassifierRisk,
  SAFETY_RULESET_VERSION,
  selfHarmIntentContext,
} from "../../shared/rules/safety";
import { clearAcuteClassifierCache } from "../../worker/ai/acute-classifier";
import { runChatPipeline } from "../../worker/ai/pipeline";
import { chatRoutes } from "../../worker/api/chat";
import type { AppVariables, Env } from "../../worker/env";

const UNCONSCIOUS = "Mẹ tôi lịm đi, không phản ứng gì cả";

function chatApp(delayMs: number) {
  const analytics: Array<Record<string, unknown>> = [];
  const calls: Array<{ aborted: boolean }> = [];
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
      async run(
        _model: string,
        inputs: { messages?: Array<{ content?: string }> },
        options?: { signal?: AbortSignal },
      ) {
        const system = inputs?.messages?.[0]?.content ?? "";
        if (system.includes("VERIFIER_IDIOM_JSON")) {
          return JSON.stringify({ crisis: true });
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          options?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
        calls.push({ aborted: Boolean(options?.signal?.aborted) });
        return JSON.stringify({
          category: "self_harm",
          acute: true,
          intent_first_person: true,
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
  return { app, env, analytics, calls };
}

async function readSse(response: Response): Promise<{ raw: string; readyAt: number }> {
  const started = performance.now();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let readyAt = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    if (readyAt === 0 && raw.includes('"type":"ready"')) {
      readyAt = performance.now() - started;
    }
  }
  return { raw, readyAt };
}

describe("emergency r16", () => {
  afterEach(() => {
    clearAcuteClassifierCache();
    vi.restoreAllMocks();
  });

  it("reverts the classifier prompt to the r14 text and keeps the verifier", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.8");
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).not.toContain(
      "Indirect first-person intent is self_harm even without",
    );
    expect(ACUTE_CLASSIFIER_SYSTEM_PROMPT).not.toContain("buông xuôi");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may escalate");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may not dismiss a real plan");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).not.toContain("third-party news");
  });

  it("F10 demotes a denial or minimizer anywhere in the sentence", () => {
    expect(evaluateHighRisk("Tôi không còn sức chịu đựng, muốn chết").riskClass).toBe(
      "self_harm",
    );
    expect(evaluateHighRisk("Tôi chưa muốn chết").riskClass).toBe("self_harm");
    expect(evaluateHighRisk("Chẳng muốn sống nữa").riskClass).toBe("self_harm");
    expect(evaluateHighRisk("Toi muon tu tu").riskClass).toBe("self_harm");

    const far = "Tôi không hề có ý định tự tử";
    expect(evaluateHighRisk(far).riskClass).not.toBe("self_harm");
    expect(hasSelfHarmCue(far)).toBe(true);
    expect(hasSelfHarmLexicon(far)).toBe(false);

    const minimized = "Em sẽ tự tử, không sao đâu";
    expect(evaluateHighRisk(minimized).riskClass).not.toBe("self_harm");
    expect(hasSelfHarmCue(minimized)).toBe(true);
    expect(hasSelfHarmLexicon(minimized)).toBe(false);
    expect(selfHarmIntentContext(minimized)).toBe(false);
  });

  it.each([
    [
      "minimizer plus accidental ingestion",
      "Em uống nhầm thuốc, không sao đâu, không định tự tử",
    ],
    ["denial plus chest", "Tôi không hề muốn tự tử, nhưng ngực đau nhói dữ dội"],
    ["denial plus bleeding", "Mình không hề muốn tự tử, máu chảy không cầm"],
    ["info question plus chest", "Đau ngực đột ngột là gì, tôi không hề muốn tự tử?"],
  ])(
    "F25 %s is not a deterministic crisis and calls the classifier",
    async (_label, question) => {
      clearAcuteClassifierCache();
      expect(evaluateHighRisk(question).riskClass).not.toBe("self_harm");
      let called = 0;
      const result = await runChatPipeline({} as Env, question, {
        classifyAcute: async () => {
          called += 1;
          return {
            status: "ok",
            cached: false,
            verdict: {
              category: "self_harm",
              acute: true,
              intent_first_person: true,
              figurative: false,
            },
          };
        },
        verifyCrisis: async () => true,
      });
      expect(result.kind).toBe("high_risk");
      if (result.kind !== "high_risk") return;
      expect(result.riskClass).not.toBe("self_harm");
      expect(result.message).not.toContain("Ở lại bên cạnh");
      const upgraded = await result.upgrade;
      expect(called).toBe(1);
      expect(upgraded?.riskClass).toBe("self_harm");
    },
  );

  it("F1 keeps passive wording on the classifier route", async () => {
    const question = "Em tính rời bỏ cuộc đời đêm nay";
    expect(evaluateHighRisk(question).matched).toBe(false);
    expect(hasSelfHarmCue(question)).toBe(true);
    expect(hasSelfHarmLexicon(question)).toBe(false);
    const escalated = await runChatPipeline({} as Env, question, {
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
      verifyCrisis: async () => true,
    });
    expect(escalated.kind).toBe("high_risk");
    if (escalated.kind === "high_risk") expect(escalated.riskClass).toBe("self_harm");
  });

  it("F2 composes a clean intent in another sentence and verifies a masked one", async () => {
    const separate = evaluateHighRisk("Em muốn chết. Em vừa uống hết vỉ thuốc.");
    expect(separate.riskClass).toBe("self_harm");
    expect(separate.message.indexOf("Ở lại bên cạnh")).toBeLessThan(
      separate.message.indexOf("Không tự gây nôn"),
    );
    expect(separate.message.split("Đây có thể là tình huống khẩn cấp").length - 1).toBe(
      1,
    );

    const masked = "Em không hề muốn tự tử. Em uống nhầm thuốc chuột.";
    const ruled = evaluateHighRisk(masked);
    expect(ruled.riskClass).toBe("poisoning");
    expect(selfHarmIntentContext(masked)).toBe(false);
    const confirmed = await runChatPipeline({} as Env, masked, {
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
      verifyCrisis: async () => true,
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind !== "high_risk") return;
    expect(confirmed.riskClass).toBe("poisoning");
    const upgraded = await confirmed.upgrade;
    expect(upgraded?.riskClass).toBe("self_harm");
    expect(upgraded?.finalMessage?.indexOf("Ở lại bên cạnh")).toBeLessThan(
      upgraded?.finalMessage?.indexOf("Không tự gây nôn") ?? -1,
    );
  });

  it("F23-T a 4.5s classifier lands and an 8s classifier logs upgrade_timeout once", async () => {
    clearAcuteClassifierCache();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const slow = chatApp(4_500);
    const started = performance.now();
    const response = await slow.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: UNCONSCIOUS }),
      },
      slow.env,
    );
    const body = (await response.json()) as { riskClass: string; content: string };
    const elapsed = performance.now() - started;
    expect(body.riskClass).toBe("self_harm");
    expect(body.content).toContain("Ở lại bên cạnh");
    expect(elapsed).toBeGreaterThan(4_200);
    expect(elapsed).toBeLessThan(6_500);
    expect(slow.analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: "self_harm" }),
    ]);
    expect(
      spy.mock.calls.some((call) => String(call[0]).includes("upgrade_timeout")),
    ).toBe(false);

    clearAcuteClassifierCache();
    spy.mockClear();
    const hung = chatApp(8_000);
    const hungStarted = performance.now();
    const hungResponse = await hung.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: UNCONSCIOUS }),
      },
      hung.env,
    );
    const { raw, readyAt } = await readSse(hungResponse);
    expect(readyAt).toBeGreaterThan(0);
    expect(readyAt).toBeLessThan(400);
    expect(performance.now() - hungStarted).toBeLessThan(7_000);
    expect(raw).toContain("unconscious");
    expect(raw).not.toContain("Ở lại bên cạnh");
    expect(hung.analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: "unconscious" }),
    ]);
    expect(
      spy.mock.calls.filter((call) => String(call[0]).includes("upgrade_timeout")),
    ).toHaveLength(1);
  }, 20_000);

  it("F23-J stream still paints first and json returns the delivered class", async () => {
    clearAcuteClassifierCache();
    const stream = chatApp(300);
    const response = await stream.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: UNCONSCIOUS }),
      },
      stream.env,
    );
    const { raw, readyAt } = await readSse(response);
    expect(readyAt).toBeLessThan(400);
    expect(raw).toContain('"type":"ready"');
    expect(raw).toContain("self_harm");
    expect(stream.analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: "self_harm" }),
    ]);

    clearAcuteClassifierCache();
    const json = chatApp(300);
    const jsonResponse = await json.app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: UNCONSCIOUS }),
      },
      json.env,
    );
    const body = (await jsonResponse.json()) as { riskClass: string; content: string };
    expect(body.riskClass).toBe("self_harm");
    expect(body.content).toContain("Ở lại bên cạnh");
    expect(json.analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: body.riskClass }),
    ]);
  }, 15_000);

  it("F12 F5 F6 F8 F13 and SEZ2 stay on the own probes", () => {
    expect(evaluateHighRisk("Dấu hiệu co giật gồm những gì").riskClass).not.toBe(
      "seizure",
    );
    expect(evaluateHighRisk("Động kinh là gì").riskClass).not.toBe("seizure");
    expect(evaluateHighRisk("Cháu đang giật không ngừng").riskClass).toBe("seizure");

    for (const question of [
      "Tôi không bị đau ngực",
      "Bé không hề co giật",
      "Hôm qua đau ngực, hôm nay đã khỏi",
    ]) {
      expect(evaluateHighRisk(question).matched, question).toBe(false);
    }

    expect(refineClassifierRisk("Hôm nay trời đẹp quá", "chest_pain")).toBeNull();
    expect(refineClassifierRisk("Cháu thở không nổi, môi tím", "chest_pain")).toBe(
      "breathing",
    );
    expect(refineClassifierRisk("Ông kêu tức ngực kèm vã mồ hôi", "chest_pain")).toBe(
      "chest_pain",
    );
    expect(refineClassifierRisk("Máu chảy không cầm từ sáng", "poisoning")).toBe(
      "bleeding",
    );
    expect(evaluateHighRisk("Bé uống nhầm nước tẩy rồi thở không nổi").riskClass).toBe(
      "breathing",
    );

    expect(evaluateHighRisk("Cháu bị bỏng nhỏ ở ngón tay").matched).toBe(false);
    expect(evaluateHighRisk("Bỏng một chút khi nấu ăn").matched).toBe(false);
    expect(
      evaluateHighRisk("Cháu dính nước sôi, da phồng rộp khắp bắp chân").riskClass,
    ).toBe("burn");

    expect(evaluateHighRisk("Hết co giật rồi, vết cũ hôm qua đã cầm").riskClass).not.toBe(
      "seizure",
    );
    expect(evaluateHighRisk("Hết co giật, đập đầu chảy máu").riskClass).toBe("seizure");
  });
});
