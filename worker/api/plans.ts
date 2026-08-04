import { Hono } from "hono";
import { CreatePlanSchema, CompleteActionSchema } from "@shared/schemas/api";
import { generateThirtyDayPlan, humanizePlanReason } from "@shared/rules/plan";
import { scoreAssessment } from "@shared/rules/scoring";
import { createId, nowIso, addDaysIso } from "@shared/utils/id";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { getAnswersMap } from "../assessment/service";

export const planRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

planRoutes.post("/plans", async (c) => {
  CreatePlanSchema.parse(await c.req.json().catch(() => ({})));

  const readiness = await c.env.DB.prepare(
    `SELECT id, public_id, run_id, overall_score, health_score, finance_score, caregiving_score,
            interpretation_json, gaps_json, strengths_json, explainability_json, scoring_ruleset_version
     FROM readiness_results WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(c.get("sessionId"))
    .first<{
      id: string;
      public_id: string;
      run_id: string;
      scoring_ruleset_version: string;
      explainability_json: string;
    }>();

  if (!readiness) {
    return jsonError(c, 404, "NOT_FOUND", "Hãy hoàn thành bài đánh giá trước khi tạo kế hoạch.");
  }

  const answers = await getAnswersMap(c.env.DB, readiness.run_id);
  const scored = scoreAssessment(answers);
  const planData = generateThirtyDayPlan(scored);

  let version = await c.env.DB.prepare(
    `SELECT id FROM plan_versions WHERE version = ?`,
  )
    .bind(planData.rulesetVersion)
    .first<{ id: string }>();
  if (!version) {
    const vid = createId("pver");
    await c.env.DB.prepare(
      `INSERT INTO plan_versions (id, version, ruleset_version, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(vid, planData.rulesetVersion, planData.rulesetVersion, nowIso())
      .run();
    version = { id: vid };
  }

  const planId = createId("plan");
  const publicId = createId("pplan");
  const start = nowIso();
  const end = addDaysIso(30);

  await c.env.DB.prepare(
    `INSERT INTO plans
     (id, public_id, session_id, readiness_result_id, plan_version_id, title, summary, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      planId,
      publicId,
      c.get("sessionId"),
      readiness.id,
      version.id,
      planData.title,
      planData.summary,
      start,
      end,
      start,
    )
    .run();

  for (const action of planData.actions) {
    await c.env.DB.prepare(
      `INSERT INTO plan_actions
       (id, public_id, plan_id, week_number, action_key, title, description, reason, effort_minutes,
        is_optional, pillar, source_ref, lesson_slug, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
      .bind(
        createId("act"),
        createId("pact"),
        planId,
        action.weekNumber,
        action.actionKey,
        action.title,
        action.description,
        action.selectionReason,
        action.effortMinutes,
        action.isOptional ? 1 : 0,
        action.pillar,
        action.sourceRef,
        action.lessonSlug ?? null,
        action.sortOrder,
      )
      .run();
  }

  return c.json({ planPublicId: publicId });
});

planRoutes.get("/plans/current", async (c) => {
  const plan = await c.env.DB.prepare(
    `SELECT id, public_id, title, summary, start_date, end_date, created_at
     FROM plans WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(c.get("sessionId"))
    .first<{
      id: string;
      public_id: string;
      title: string;
      summary: string;
      start_date: string;
      end_date: string;
      created_at: string;
    }>();

  if (!plan) return jsonError(c, 404, "NOT_FOUND", "Chưa có kế hoạch.");

  const actions = await c.env.DB.prepare(
    `SELECT a.public_id, a.week_number, a.action_key, a.title, a.description, a.reason,
            a.effort_minutes, a.is_optional, a.pillar, a.source_ref, a.lesson_slug, a.sort_order, a.status,
            c.completed_at, c.difficulty, c.confidence
     FROM plan_actions a
     LEFT JOIN action_completions c ON c.action_id = a.id AND c.session_id = ?
     WHERE a.plan_id = ?
     ORDER BY a.week_number, a.sort_order`,
  )
    .bind(c.get("sessionId"), plan.id)
    .all();

  return c.json({
    plan: {
      publicId: plan.public_id,
      title: plan.title,
      summary: plan.summary,
      startDate: plan.start_date,
      endDate: plan.end_date,
      createdAt: plan.created_at,
      actions: (actions.results ?? []).map((a) => ({
        publicId: a.public_id,
        weekNumber: a.week_number,
        actionKey: a.action_key,
        title: a.title,
        description: a.description,
        reason: humanizePlanReason(String(a.reason ?? ""), String(a.action_key ?? "")),
        effortMinutes: a.effort_minutes,
        isOptional: !!a.is_optional,
        pillar: a.pillar,
        sourceRef: a.source_ref,
        lessonSlug: a.lesson_slug,
        status: a.completed_at ? "completed" : a.status,
        completedAt: a.completed_at,
        difficulty: a.difficulty,
        confidence: a.confidence,
      })),
    },
  });
});

planRoutes.post("/actions/:id/complete", async (c) => {
  const actionPublicId = c.req.param("id");
  const body = CompleteActionSchema.parse(await c.req.json().catch(() => ({})));

  const action = await c.env.DB.prepare(
    `SELECT a.id, p.session_id
     FROM plan_actions a
     JOIN plans p ON p.id = a.plan_id
     WHERE a.public_id = ?`,
  )
    .bind(actionPublicId)
    .first<{ id: string; session_id: string }>();

  if (!action) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy hành động.");
  if (action.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Bạn không có quyền với hành động này.");
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM action_completions WHERE action_id = ? AND session_id = ?`,
  )
    .bind(action.id, c.get("sessionId"))
    .first();

  if (existing) {
    return jsonError(c, 409, "CONFLICT", "Hành động đã được hoàn thành.");
  }

  await c.env.DB.prepare(
    `INSERT INTO action_completions (id, action_id, session_id, completed_at, difficulty, confidence, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      createId("acomp"),
      action.id,
      c.get("sessionId"),
      nowIso(),
      body.difficulty ?? null,
      body.confidence ?? null,
      body.note ?? null,
    )
    .run();

  await c.env.DB.prepare(`UPDATE plan_actions SET status = 'completed' WHERE id = ?`)
    .bind(action.id)
    .run();

  return c.json({ completed: true });
});
