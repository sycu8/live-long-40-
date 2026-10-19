import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { chatRoutes } from "../../worker/api/chat";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { AppVariables, Env } from "../../worker/env";

const LATE_QUESTION = "Tim đập loạn, đổ mồ hôi lạnh, không dám cử động";

const CHEST = {
  category: "chest" as const,
  acute: true,
  intent_first_person: false,
  figurative: false,
};

describe("late acute alert", () => {
  it("keeps the first answer token ahead of the classifier, then reports the class", async () => {
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
                    content: `${LATE_QUESTION}. Ngồi nghỉ và gọi cấp cứu khi đau ngực cấp.`,
                    heading: "Đau ngực cấp",
                    source_id: "who-chest",
                    title: "Đau ngực cấp",
                    issuer: "Tổ chức Y tế Thế giới",
                    publication_date: "2024-01-01",
                    original_url:
                      "https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)",
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
        async run() {
          return { response: "Ngồi nghỉ, nới áo, ở bên cạnh. [S1]" };
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(env, LATE_QUESTION, {
      classifyAcute: async () => {
        await gate;
        return { status: "ok", cached: false, verdict: CHEST };
      },
    });
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;

    const reader = result.stream.getReader();
    const first = await reader.read();
    expect(first.value ?? "").not.toContain("Nên làm");
    let settled = false;
    const riskTask = result.riskPromise.then((risk) => {
      settled = true;
      return risk;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    release();
    expect(await riskTask).toBe("chest_pain");
    let rest = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      rest += next.value ?? "";
    }
    const full = await result.fullTextPromise;
    expect(full).toContain("Nên làm");
    expect(full).toContain("Gọi 115");
    expect(rest).toContain("Nên làm");
  });

  it("updates meta, D1, and risk_routed when the alert arrives after the refusal", async () => {
    const inserts: Array<{ sql: string; binds: unknown[] }> = [];
    const analytics: unknown[] = [];
    const env = {
      DB: {
        prepare(sql: string) {
          const statement = {
            async all() {
              return { results: [] };
            },
            async run() {
              inserts.push({ sql, binds: [] });
              return { success: true };
            },
            async first() {
              if (sql.includes("chat_sessions")) {
                return { id: "cs1", session_id: "sess-1", history_opt_in: 0 };
              }
              return null;
            },
            bind(...binds: unknown[]) {
              return {
                async all() {
                  return { results: [] };
                },
                async run() {
                  inserts.push({ sql, binds });
                  return { success: true };
                },
                async first() {
                  if (sql.includes("chat_sessions")) {
                    return { id: "cs1", session_id: "sess-1", history_opt_in: 0 };
                  }
                  return null;
                },
              };
            },
          };
          return statement;
        },
      },
      AI: {
        async run() {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { response: JSON.stringify(CHEST) };
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

    const response = await app.request(
      "/chat/sessions/pcs-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: LATE_QUESTION }),
      },
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    const events = body
      .split("\n\n")
      .map((block) => block.replace(/^data:\s*/, "").trim())
      .filter((block) => block.startsWith("{"))
      .map(
        (block) =>
          JSON.parse(block) as {
            type?: string;
            riskClass?: string;
            text?: string;
            classification?: string;
          },
      );

    const metas = events.filter((event) => event.type === "meta");
    expect(metas[0]?.riskClass).toBe("none");
    const late = metas.find((event) => event.riskClass === "chest_pain");
    expect(late?.classification).toBe("high_risk_health");
    const lateAt = events.indexOf(late!);
    const openingAt = events.findIndex(
      (event) => event.type === "token" && !event.text?.includes("Nên làm"),
    );
    expect(openingAt).toBeGreaterThanOrEqual(0);
    expect(lateAt).toBeGreaterThan(openingAt);
    expect(
      events.some((event) => event.type === "token" && event.text?.includes("Nên làm")),
    ).toBe(true);

    const stored = inserts.find(
      (row) => row.sql.includes("classification") && row.sql.includes("'assistant'"),
    );
    expect(stored?.binds).toContain("high_risk_health");
    expect(stored?.binds).toContain("chest_pain");
    expect(stored?.binds).toContain(0);
    expect(analytics).toEqual([
      expect.objectContaining({ type: "risk_routed", riskClass: "chest_pain" }),
    ]);
    expect(JSON.stringify(analytics)).not.toContain(LATE_QUESTION);
  });
});
