import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { Env, AppVariables } from "./env";
import {
  requestContext,
  securityHeaders,
  anonymousSession,
  csrfProtection,
  requireAdmin,
} from "./middleware/security";
import { assessmentRoutes } from "./api/assessment";
import { planRoutes } from "./api/plans";
import { libraryRoutes } from "./api/library";
import { chatRoutes } from "./api/chat";
import { blogRoutes } from "./api/blog";
import { adminRoutes } from "./api/admin";
import { crawlRoutes } from "./seo/crawl";
import { discoveryRoutes } from "./discovery/routes";
import { runBlogDailyJob } from "./blog/schedule";
import { IngestionWorkflow } from "./workflows/ingestion";
import { DISCLAIMER, EXAMPLE_QUESTIONS } from "@shared/constants/product";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", requestContext);
app.use("*", securityHeaders);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    app: c.env.APP_NAME ?? "VivaAge",
    environment: c.env.ENVIRONMENT ?? "unknown",
    // booleans only — never expose secret values
    adminSecretConfigured: Boolean(
      c.env.ADMIN_SHARED_SECRET || c.env.LOCAL_QA_ADMIN_TOKEN,
    ),
    turnstileConfigured: Boolean(c.env.TURNSTILE_SECRET_KEY),
  }),
);

app.get("/api/v1/meta", (c) =>
  c.json({
    name: "VivaAge",
    disclaimer: DISCLAIMER,
    exampleQuestions: EXAMPLE_QUESTIONS,
    chatHistoryDefault: c.env.FEATURE_CHAT_HISTORY_DEFAULT === "true",
    versions: {
      prompt: c.env.PROMPT_VERSION,
      scoring: c.env.SCORING_RULESET_VERSION,
      safety: c.env.SAFETY_RULESET_VERSION,
      plan: c.env.PLAN_RULESET_VERSION,
    },
  }),
);

const api = new Hono<{ Bindings: Env; Variables: AppVariables }>();
api.use("*", anonymousSession);
api.use("*", csrfProtection);
api.route("/", assessmentRoutes);
api.route("/", planRoutes);
api.route("/", libraryRoutes);
api.route("/", chatRoutes);
api.route("/", blogRoutes);

app.route("/api/v1", api);

/** Agent discovery + homepage Link headers (RFC 8288 / 9727). */
app.route("/", discoveryRoutes);

/** Crawlable SEO surfaces (sitemap / robots / Atom) — outside /api. */
app.route("/", crawlRoutes);

const admin = new Hono<{ Bindings: Env; Variables: AppVariables }>();
admin.use("*", anonymousSession);
admin.use("*", requireAdmin);
admin.use("*", csrfProtection);
admin.route("/", adminRoutes);
app.route("/api/v1/admin", admin);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ.",
          details: err.issues,
        },
      },
      400,
    );
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(JSON.stringify({ level: "error", message: String(err) }));
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Đã xảy ra lỗi hệ thống.",
      },
    },
    500,
  );
});

async function handleQueue(batch: MessageBatch, env: Env) {
  for (const msg of batch.messages) {
    const body = msg.body as {
      type?: string;
      jobId?: string;
      sourceId?: string;
      reviewedText?: string;
      riskClass?: string;
      at?: string;
    };
    if (body.type === "ingest" && body.jobId && body.sourceId) {
      if (!env.INGESTION_WORKFLOW) {
        msg.ack();
        continue;
      }
      try {
        await env.INGESTION_WORKFLOW.create({
          params: {
            jobId: body.jobId,
            sourceId: body.sourceId,
            reviewedText: body.reviewedText,
          },
        });
        msg.ack();
      } catch {
        msg.retry();
      }
    } else if (body.type === "risk_routed" || body.type === "analytics") {
      // Privacy-safe operational analytics — no question text stored
      msg.ack();
    } else {
      msg.ack();
    }
  }
}

export { IngestionWorkflow };

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch, env: Env) {
    await handleQueue(batch, env);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runBlogDailyJob(env)
        .then((result) => {
          console.log(
            JSON.stringify({
              level: "info",
              message: "blog_daily_job",
              ...result,
            }),
          );
        })
        .catch((err: unknown) => {
          console.error(
            JSON.stringify({
              level: "error",
              message: "blog_daily_job_failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }),
    );
  },
};
