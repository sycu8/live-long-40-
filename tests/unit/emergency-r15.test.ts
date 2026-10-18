import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAcuteClassifierCache } from "../../worker/ai/acute-classifier";
import { chatRoutes, takeUpgrade, UPGRADE_WAIT_MS } from "../../worker/api/chat";
import { runChatPipeline } from "../../worker/ai/pipeline";
import { decide, ruleViewFor } from "../../shared/rules/precedence";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  hasSelfHarmCue,
  hasSelfHarmLexicon,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
} from "../../shared/rules/safety";
import { ACUTE_VERIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import type { AppVariables, Env } from "../../worker/env";

const HEADER = "Đây có thể là tình huống khẩn cấp";
const UNCONSCIOUS = "Mẹ tôi lịm đi, không phản ứng gì cả";

type AiCall = { aborted: boolean; elapsed: number };

function headerCount(message: string): number {
  return message.split(HEADER).length - 1;
}

function chatApp() {
  const analytics: Array<Record<string, unknown>> = [];
  const updates: unknown[][] = [];
  const calls: AiCall[] = [];
  let delayMs = 0;
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
          bind(...args: unknown[]) {
            const bound = {
              ...statement,
              async run() {
                if (sql.includes("UPDATE chat_messages")) updates.push(args);
                return { success: true };
              },
            };
            return bound;
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
        const started = Date.now();
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        calls.push({
          aborted: Boolean(options?.signal?.aborted),
          elapsed: Date.now() - started,
        });
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
  return {
    app,
    env,
    analytics,
    updates,
    calls,
    setDelay: (ms: number) => (delayMs = ms),
  };
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

describe("emergency r15", () => {
  afterEach(() => {
    clearAcuteClassifierCache();
    vi.useRealTimers();
  });

  it("is ruleset v1.8.8 and keeps the reverted verifier prompt", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.8");
    expect(UPGRADE_WAIT_MS).toBe(6000);
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may escalate");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may not dismiss a real plan");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).not.toContain("third-party news");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).not.toContain("buông xuôi");
  });

  it("keeps the first class when the upgrade wait expires", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = new Promise<{ message: string; riskClass: string } | null>(
      () => undefined,
    );
    const resultPromise = takeUpgrade("unconscious", pending, UPGRADE_WAIT_MS);
    await vi.advanceTimersByTimeAsync(UPGRADE_WAIT_MS);
    await expect(resultPromise).resolves.toEqual({
      riskClass: "unconscious",
      extra: null,
      finalMessage: null,
      timedOut: true,
    });
    expect(
      spy.mock.calls.some((call) => String(call[0]).includes("upgrade_timeout")),
    ).toBe(true);
    spy.mockRestore();
  });

  it("applies an upgrade only when the new class is strictly more severe", async () => {
    const escalated = await takeUpgrade(
      "unconscious",
      Promise.resolve({ message: "\n\nỞ lại bên cạnh", riskClass: "self_harm" }),
      UPGRADE_WAIT_MS,
    );
    expect(escalated.riskClass).toBe("self_harm");
    expect(escalated.extra).toContain("Ở lại bên cạnh");
    expect(escalated.timedOut).toBe(false);

    const downgraded = await takeUpgrade(
      "unconscious",
      Promise.resolve({ message: "\n\npoison", riskClass: "poisoning" }),
      UPGRADE_WAIT_MS,
    );
    expect(downgraded).toEqual({
      riskClass: "unconscious",
      extra: null,
      finalMessage: null,
      timedOut: false,
    });
  });

  it.each([1800, 3000])(
    "F23 stream keeps a %sms classifier and escalates once",
    async (delay) => {
      clearAcuteClassifierCache();
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const harness = chatApp();
      harness.setDelay(delay);
      const started = performance.now();
      const response = await harness.app.request(
        "/chat/sessions/pcs-1/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: UNCONSCIOUS }),
        },
        harness.env,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const { raw, readyAt } = await readSse(response);
      expect(readyAt).toBeGreaterThan(0);
      expect(readyAt).toBeLessThan(400);
      expect(performance.now() - started).toBeGreaterThan(delay - 100);
      expect(raw).toContain("unconscious");
      expect(raw).toContain("self_harm");
      expect(raw).toContain("Ở lại bên cạnh");
      expect(raw).not.toContain("1900");
      expect(headerCount(raw)).toBeGreaterThan(0);
      expect(harness.calls).toHaveLength(1);
      expect(harness.calls[0]?.aborted).toBe(false);
      expect(harness.calls[0]?.elapsed).toBeGreaterThanOrEqual(delay - 50);
      expect(harness.analytics).toEqual([
        expect.objectContaining({ type: "risk_routed", riskClass: "self_harm" }),
      ]);
      expect(harness.updates.some((args) => args.includes("self_harm"))).toBe(true);
      expect(
        spy.mock.calls.some((call) => String(call[0]).includes("upgrade_timeout")),
      ).toBe(false);
      spy.mockRestore();
    },
    20_000,
  );

  it.each([1800, 3000])(
    "F23 json waits out a %sms classifier and returns the final class",
    async (delay) => {
      clearAcuteClassifierCache();
      const harness = chatApp();
      harness.setDelay(delay);
      const started = performance.now();
      const response = await harness.app.request(
        "/chat/sessions/pcs-1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ content: UNCONSCIOUS }),
        },
        harness.env,
      );
      const returnedAt = performance.now() - started;
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const body = (await response.json()) as { riskClass: string; content: string };
      expect(returnedAt).toBeGreaterThan(delay - 100);
      expect(returnedAt).toBeLessThan(delay + 2_500);
      expect(body.riskClass).toBe("self_harm");
      expect(body.content).toContain("Gọi 115");
      expect(body.content).toContain("Ở lại bên cạnh");
      expect(harness.analytics).toEqual([
        expect.objectContaining({ type: "risk_routed", riskClass: "self_harm" }),
      ]);
      expect(harness.calls).toHaveLength(1);
      expect(harness.calls[0]?.aborted).toBe(false);
      expect(harness.calls[0]?.elapsed).toBeGreaterThanOrEqual(delay - 50);
      expect(harness.updates.some((args) => args.includes("self_harm"))).toBe(true);
    },
    20_000,
  );

  it("F1 routes indirect first-person intent through the classifier and verifier", async () => {
    const question = "Em tính buông xuôi cuộc đời đêm nay";
    expect(evaluateHighRisk(question).matched).toBe(false);
    expect(hasSelfHarmCue(question)).toBe(true);
    expect(hasSelfHarmLexicon(question)).toBe(false);
    const verdict = {
      status: "ok" as const,
      cached: false,
      verdict: {
        category: "self_harm" as const,
        acute: true,
        intent_first_person: true,
        figurative: false,
      },
    };
    const escalated = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => verdict,
      verifyCrisis: async () => true,
    });
    expect(escalated.kind).toBe("high_risk");
    if (escalated.kind === "high_risk") {
      expect(escalated.riskClass).toBe("self_harm");
      expect(escalated.message).toContain("Ở lại bên cạnh");
      expect(escalated.message).toMatch(/gọi 115/i);
      expect(escalated.message).not.toContain("1900");
    }
    const declined = await runChatPipeline({} as Env, question, {
      classifyAcute: async () => verdict,
      verifyCrisis: async () => false,
    });
    expect(declined.kind).toBe("abstain");
    if (declined.kind === "abstain") {
      const extra = declined.followUp ? (await declined.followUp).extra : "";
      expect(`${declined.message}${extra}`).toContain(GENTLE_SUPPORT_LINE);
      expect(`${declined.message}${extra}`).not.toContain("Nên làm");
    }
  });

  it("F2 composes the crisis block when poisoning meets intent, with one header", async () => {
    const ruled = evaluateHighRisk("Tôi không muốn sống nữa và đã uống thuốc chuột");
    expect(ruled.riskClass).toBe("self_harm");
    expect(ruled.message).toContain("Ở lại bên cạnh");
    expect(ruled.message).toContain("Không tự gây nôn");
    expect(ruled.message).toContain("giữ vỏ thuốc");
    expect(ruled.message.indexOf("Ở lại bên cạnh")).toBeLessThan(
      ruled.message.indexOf("Không tự gây nôn"),
    );
    expect(headerCount(ruled.message)).toBe(1);
    expect(ruled.message.match(/Nên làm:/g)?.length).toBe(2);

    const question = "Em tính buông xuôi cuộc đời và đã nuốt thuốc";
    expect(evaluateHighRisk(question).riskClass).not.toBe("self_harm");
    const result = await runChatPipeline({} as Env, question, {
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
      verifyCrisis: async () => false,
    });
    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("self_harm");
    expect(result.message).toContain("Ở lại bên cạnh");
    expect(result.message).toContain("Không tự gây nôn");
    expect(headerCount(result.message)).toBe(1);
    expect(result.message).not.toContain("1900");
  });

  it("F10 keeps a 2-token denial off the immediate screen and on the verifier route", async () => {
    const denied = "Tôi không muốn tự tử";
    expect(evaluateHighRisk(denied).riskClass).not.toBe("self_harm");
    expect(hasSelfHarmCue(denied)).toBe(true);
    expect(hasSelfHarmLexicon(denied)).toBe(false);
    const rules = ruleViewFor(denied);
    expect(rules.class).toBeNull();
    expect(rules.selfHarmLexicon).toBe(false);
    expect(rules.acuteCue).toBe(true);
    expect(decide(rules, null, true)).toEqual({ kind: "screen", riskClass: "urgent" });
    const verdict = {
      status: "ok" as const,
      cached: false,
      verdict: {
        category: "self_harm" as const,
        acute: true,
        intent_first_person: true,
        figurative: false,
      },
    };
    const confirmed = await runChatPipeline({} as Env, denied, {
      classifyAcute: async () => verdict,
      verifyCrisis: async () => true,
    });
    expect(confirmed.kind).toBe("high_risk");
    if (confirmed.kind === "high_risk") expect(confirmed.riskClass).toBe("self_harm");
    const rejected = await runChatPipeline({} as Env, denied, {
      classifyAcute: async () => verdict,
      verifyCrisis: async () => false,
    });
    expect(rejected.kind).toBe("abstain");
    const minimized = "Em không định tự tử, không sao đâu";
    expect(evaluateHighRisk(minimized).riskClass).not.toBe("self_harm");
    expect(hasSelfHarmCue(minimized)).toBe(true);
    expect(hasSelfHarmLexicon(minimized)).toBe(false);
  });

  it("F21 chest distress still has no crisis block", () => {
    const chest = evaluateHighRisk("Bố tôi đau ngực không chịu nổi");
    expect(chest.riskClass).toBe("chest_pain");
    expect(chest.message).not.toContain("Ở lại bên cạnh");
    expect(headerCount(chest.message)).toBe(1);
  });

  it("F20 treats another unresponsive phrasing as still acute", () => {
    expect(seizureLooksResolved("Hết co giật nhưng không trả lời")).toBe(false);
    const result = evaluateHighRisk("Hết co giật nhưng không trả lời");
    expect(result.riskClass).toBe("seizure");
    expect(result.message).not.toContain("Cơn co giật đã qua");
    expect(seizureLooksResolved("Bé hết co giật rồi")).toBe(true);
    expect(evaluateHighRisk("Hết co giật hôm qua có chảy máu").riskClass).not.toBe(
      "seizure",
    );
  });
});
