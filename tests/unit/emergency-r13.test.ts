import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ACUTE_VERIFIER_SYSTEM_PROMPT } from "../../shared/rules/acute-classifier-prompt";
import { decide, ruleViewFor } from "../../shared/rules/precedence";
import {
  evaluateHighRisk,
  hasSelfHarmCue,
  SAFETY_RULESET_VERSION,
  seizureLooksResolved,
} from "../../shared/rules/safety";
import { chatRoutes } from "../../worker/api/chat";
import type { AppVariables, Env } from "../../worker/env";

const cases = JSON.parse(
  readFileSync(new URL("../fixtures/qa-emergency-cases.json", import.meta.url), "utf8"),
) as Array<{ id: string; q: string }>;

describe("emergency precedence r13", () => {
  it("is ruleset v1.8.9 and restores the verifier prompt", () => {
    expect(SAFETY_RULESET_VERSION).toBe("v1.8.9");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may escalate");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).toContain("You may not dismiss a real plan");
    expect(ACUTE_VERIFIER_SYSTEM_PROMPT).not.toContain("third-party news");
  });

  it("F21 keeps ordinary health questions off the crisis screen", () => {
    const f06 = cases.find((item) => item.id === "F06");
    expect(f06?.q).toBe("BỐ TÔI ĐỘT NHIÊN MÉO MIỆNG");
    const probes: Array<[string, string, string | null]> = [
      ["F06", f06!.q, "stroke"],
      ["probe-01", "Bố tôi đau ngực không chịu nổi", "chest_pain"],
      ["probe-02", "Mình không chịu nổi cơn đau ngực", "chest_pain"],
      ["probe-03", "Em đau đầu không chịu nổi", null],
      ["probe-04", "Tôi sốt không chịu nổi", null],
      ["probe-05", "Bà tôi ho không chịu nổi", null],
      ["probe-06", "Ông tôi nhức khớp không chịu nổi", null],
      ["probe-07", "Tôi bị tiêu chảy không chịu nổi", null],
      ["probe-08", "Em mỏi mắt không chịu nổi", null],
      ["probe-09", "Mình ngứa không chịu nổi", null],
      ["probe-10", "Tôi đau răng không chịu nổi", null],
      ["probe-11", "Bố tôi khó ngủ không chịu nổi", null],
      ["probe-12", "Em bị cảm không chịu nổi", null],
    ];
    for (const [id, question, expected] of probes) {
      const result = evaluateHighRisk(question);
      if (expected) expect(result.riskClass, id).toBe(expected);
      expect(result.riskClass, id).not.toBe("self_harm");
      expect(result.message, id).not.toContain("Ở lại bên cạnh");
      expect(result.message, id).not.toContain("1900");
    }
    const chest = evaluateHighRisk("Bố tôi đau ngực không chịu nổi");
    expect(chest.message).toContain("đau hoặc tức ngực");
    expect(chest.message).toMatch(/gọi 115/i);
  });

  it("F19 leaves a no-longer cue visible and keeps a true denial off the screen", () => {
    const denied = "Tôi không còn muốn tự tử";
    expect(evaluateHighRisk(denied).riskClass).not.toBe("self_harm");
    expect(hasSelfHarmCue(denied)).toBe(true);
    const rules = ruleViewFor(denied);
    expect(rules.class).toBeNull();
    expect(rules.selfHarmLexicon).toBe(true);
    expect(decide(rules, null, true)).toEqual({ kind: "screen", riskClass: "urgent" });
  });

  it("F2 keeps the crisis block first and the acute steps under it", () => {
    const rows = [
      ["v6-002", "Em muốn chết nên uống hết vỉ thuốc", "Không tự gây nôn"],
      ["v6-008", "Tôi không muốn sống nữa và đã uống thuốc chuột", "Không tự gây nôn"],
      ["v7-005", "Mình định giết mình và đang đau ngực dữ dội", "đau hoặc tức ngực"],
    ] as const;
    for (const [id, question, acuteStep] of rows) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, id).toBe("self_harm");
      const crisisAt = result.message.indexOf("Ở lại bên cạnh");
      const acuteAt = result.message.indexOf(acuteStep);
      expect(crisisAt, id).toBeGreaterThan(-1);
      expect(acuteAt, id).toBeGreaterThan(crisisAt);
      expect(result.message, id).toMatch(/gọi 115/i);
      expect(result.message, id).not.toContain("1900");
    }
  });

  it("F20 and SEZ2 keep a still-dangerous seizure acute and ignore old bleeding", () => {
    for (const [id, question] of [
      ["unresponsive", "Hết co giật nhưng không còn phản ứng"],
      ["asleep", "Co giật xong rồi, gọi không được, mê man"],
      ["ten-minutes", "Co giật đã qua nhưng kéo dài hơn 10 phút"],
    ] as const) {
      expect(seizureLooksResolved(question), id).toBe(false);
      const result = evaluateHighRisk(question);
      expect(result.matched, id).toBe(true);
      expect(result.riskClass, id).not.toBe("self_harm");
      expect(result.message, id).not.toContain("Cơn co giật đã qua");
      expect(result.message, id).toMatch(/gọi 115/i);
    }
    for (const [id, question] of [
      ["old-bleed", "Hết co giật hôm qua có chảy máu"],
      ["earlier-bleed", "Bé hết co giật rồi, trước đó có chảy máu"],
    ] as const) {
      expect(seizureLooksResolved(question), id).toBe(true);
      expect(evaluateHighRisk(question).riskClass, id).not.toBe("seizure");
      expect(evaluateHighRisk(question).message, id).not.toContain("Không nhét");
    }
    expect(evaluateHighRisk("Hết co giật, đập đầu chảy máu").riskClass).toBe("seizure");
  });

  it("F22 releases an unconscious screen while the classifier stalls and routes once", async () => {
    const analytics: unknown[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
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
        async run() {
          return new Promise(() => undefined);
        },
      },
      ANALYTICS_QUEUE: {
        async send(body: unknown) {
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
    const started = performance.now();
    const response = await app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Mẹ tôi lịm đi, không phản ứng gì cả" }),
      },
      env,
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let readyAt = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      if (readyAt === 0 && body.includes('"type":"ready"')) {
        readyAt = performance.now() - started;
      }
    }
    expect(readyAt).toBeGreaterThan(0);
    expect(readyAt).toBeLessThan(400);
    expect(body).toContain("unconscious");
    expect(body).toContain("Gọi 115");
    expect(body).not.toContain("1900");
    expect(analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: "unconscious" }),
    ]);
    expect(
      errorSpy.mock.calls.filter((call) => String(call[0]).includes("upgrade_timeout")),
    ).toHaveLength(1);
    errorSpy.mockRestore();
  }, 20_000);
});
