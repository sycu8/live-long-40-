import { Hono } from "hono";
import {
  CreateSessionSchema,
  SaveAnswerSchema,
  CompleteAssessmentSchema,
} from "@shared/schemas/api";
import { createId, nowIso } from "@shared/utils/id";
import { humanizeResultPhrases } from "@shared/rules/scoring";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import {
  getOrSeedCurrentDefinition,
  getAnswersMap,
  computeScores,
} from "../assessment/service";
import { enforceRateLimit } from "../middleware/security";

export const assessmentRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

assessmentRoutes.post("/session", async (c) => {
  const body = CreateSessionSchema.parse(await c.req.json().catch(() => ({})));
  if (body.consentAnalytics) {
    await c.env.DB.prepare(
      `INSERT INTO consent_events (id, session_id, consent_type, granted, created_at)
       VALUES (?, ?, 'analytics', 1, ?)`,
    )
      .bind(createId("consent"), c.get("sessionId"), nowIso())
      .run();
  }
  return c.json({
    sessionPublicId: c.get("sessionPublicId"),
    csrfToken: c.get("csrfToken"),
  });
});

assessmentRoutes.get("/assessment/current", async (c) => {
  const { definition, questions } = await getOrSeedCurrentDefinition(c.env.DB);
  return c.json({
    definition: {
      id: definition.id,
      version: definition.version,
      title: definition.title,
      description: definition.description,
      scoringRulesetVersion: definition.scoring_ruleset_version,
      questionCount: questions.length,
    },
    questions: questions.map((q) => ({
      id: q.id,
      key: q.question_key,
      sortOrder: q.sort_order,
      pillar: q.pillar,
      prompt: q.prompt,
      helpText: q.help_text,
      whyImportant: q.why_important,
      inputType: q.input_type,
      options: JSON.parse(q.options_json),
      required: !!q.required,
    })),
  });
});

assessmentRoutes.post("/assessment/runs", async (c) => {
  const ok = await enforceRateLimit(c, "assessment_create", 60, 3600);
  if (!ok) {
    return jsonError(c, 429, "RATE_LIMITED", "Bạn đã tạo quá nhiều bài đánh giá. Thử lại sau.");
  }
  const { definition, questions } = await getOrSeedCurrentDefinition(c.env.DB);
  const id = createId("run");
  const publicId = createId("prun");
  const first = questions[0];
  await c.env.DB.prepare(
    `INSERT INTO assessment_runs
     (id, public_id, session_id, definition_id, status, current_question_key, started_at, scoring_ruleset_version)
     VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
  )
    .bind(
      id,
      publicId,
      c.get("sessionId"),
      definition.id,
      first?.question_key ?? null,
      nowIso(),
      definition.scoring_ruleset_version,
    )
    .run();

  return c.json({
    run: {
      publicId,
      status: "in_progress",
      currentQuestionKey: first?.question_key ?? null,
      totalQuestions: questions.length,
    },
  });
});

assessmentRoutes.put("/assessment/runs/:id/answers/:questionId", async (c) => {
  const runPublicId = c.req.param("id");
  const questionId = c.req.param("questionId");
  const body = SaveAnswerSchema.parse(await c.req.json());

  const run = await c.env.DB.prepare(
    `SELECT id, session_id, status, definition_id FROM assessment_runs WHERE public_id = ?`,
  )
    .bind(runPublicId)
    .first<{ id: string; session_id: string; status: string; definition_id: string }>();

  if (!run) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy bài đánh giá.");
  if (run.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Bạn không có quyền với bài đánh giá này.");
  }
  if (run.status !== "in_progress") {
    return jsonError(c, 409, "CONFLICT", "Bài đánh giá đã hoàn thành.");
  }

  const question = await c.env.DB.prepare(
    `SELECT id, question_key, options_json FROM assessment_questions WHERE id = ? AND definition_id = ?`,
  )
    .bind(questionId, run.definition_id)
    .first<{ id: string; question_key: string; options_json: string }>();

  if (!question) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy câu hỏi.");

  const options = JSON.parse(question.options_json) as Array<{ value: string }>;
  if (!options.some((o) => o.value === body.value)) {
    return jsonError(c, 400, "VALIDATION_ERROR", "Giá trị trả lời không hợp lệ.");
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM assessment_answers WHERE run_id = ? AND question_id = ?`,
  )
    .bind(run.id, question.id)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE assessment_answers SET answer_value = ?, answered_at = ? WHERE id = ?`,
    )
      .bind(body.value, nowIso(), existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO assessment_answers (id, run_id, question_id, answer_value, answered_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(createId("ans"), run.id, question.id, body.value, nowIso())
      .run();
  }

  const questions = await c.env.DB.prepare(
    `SELECT id, question_key, sort_order FROM assessment_questions WHERE definition_id = ? ORDER BY sort_order`,
  )
    .bind(run.definition_id)
    .all<{ id: string; question_key: string; sort_order: number }>();

  const ordered = questions.results ?? [];
  const idx = ordered.findIndex((q) => q.id === question.id);
  const next = ordered[idx + 1] ?? null;

  await c.env.DB.prepare(
    `UPDATE assessment_runs SET current_question_key = ? WHERE id = ?`,
  )
    .bind(next?.question_key ?? question.question_key, run.id)
    .run();

  return c.json({
    saved: true,
    nextQuestionKey: next?.question_key ?? null,
    progress: {
      answered: idx + 1,
      total: ordered.length,
    },
  });
});

assessmentRoutes.post("/assessment/runs/:id/complete", async (c) => {
  CompleteAssessmentSchema.parse(await c.req.json().catch(() => ({ confirm: true })));
  const runPublicId = c.req.param("id");
  const run = await c.env.DB.prepare(
    `SELECT id, session_id, status, scoring_ruleset_version FROM assessment_runs WHERE public_id = ?`,
  )
    .bind(runPublicId)
    .first<{
      id: string;
      session_id: string;
      status: string;
      scoring_ruleset_version: string;
    }>();

  if (!run) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy bài đánh giá.");
  if (run.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Bạn không có quyền với bài đánh giá này.");
  }

  const answers = await getAnswersMap(c.env.DB, run.id);
  const scored = computeScores(answers);
  const resultId = createId("res");
  const publicId = createId("pres");

  await c.env.DB.prepare(
    `INSERT INTO readiness_results
     (id, public_id, run_id, session_id, overall_score, health_score, finance_score, caregiving_score,
      interpretation_json, gaps_json, strengths_json, explainability_json, scoring_ruleset_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      resultId,
      publicId,
      run.id,
      c.get("sessionId"),
      scored.overallScore,
      scored.pillars.health.score,
      scored.pillars.finance.score,
      scored.pillars.caregiving.score,
      JSON.stringify(scored.interpretations),
      JSON.stringify(scored.gaps),
      JSON.stringify(scored.strengths),
      JSON.stringify({
        breakdown: scored.breakdown,
        unanswered: {
          health: scored.pillars.health.unansweredKeys,
          finance: scored.pillars.finance.unansweredKeys,
          caregiving: scored.pillars.caregiving.unansweredKeys,
        },
      }),
      scored.rulesetVersion,
      nowIso(),
    )
    .run();

  await c.env.DB.prepare(
    `UPDATE assessment_runs SET status = 'completed', completed_at = ? WHERE id = ?`,
  )
    .bind(nowIso(), run.id)
    .run();

  return c.json({
    result: {
      publicId,
      overallScore: scored.overallScore,
      pillars: [
        {
          pillar: "health",
          score: scored.pillars.health.score,
          interpretation: scored.interpretations.health,
        },
        {
          pillar: "finance",
          score: scored.pillars.finance.score,
          interpretation: scored.interpretations.finance,
        },
        {
          pillar: "caregiving",
          score: scored.pillars.caregiving.score,
          interpretation: scored.interpretations.caregiving,
        },
      ],
      gaps: scored.gaps,
      strengths: scored.strengths,
      explainability: {
        breakdown: scored.breakdown,
        unanswered: {
          health: scored.pillars.health.unansweredKeys,
          finance: scored.pillars.finance.unansweredKeys,
          caregiving: scored.pillars.caregiving.unansweredKeys,
        },
      },
      scoringRulesetVersion: scored.rulesetVersion,
      disclaimer:
        "Đây là điểm chuẩn bị của bạn, không phải kết luận bệnh hay dự đoán tuổi thọ.",
    },
  });
});

assessmentRoutes.get("/readiness/current", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT public_id, overall_score, health_score, finance_score, caregiving_score,
            interpretation_json, gaps_json, strengths_json, explainability_json, scoring_ruleset_version, created_at
     FROM readiness_results WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(c.get("sessionId"))
    .first<{
      public_id: string;
      overall_score: number;
      health_score: number;
      finance_score: number;
      caregiving_score: number;
      interpretation_json: string;
      gaps_json: string;
      strengths_json: string;
      explainability_json: string;
      scoring_ruleset_version: string;
      created_at: string;
    }>();

  if (!row) {
    return jsonError(c, 404, "NOT_FOUND", "Chưa có kết quả đánh giá mức độ chuẩn bị.");
  }

  const interpretations = JSON.parse(row.interpretation_json) as Record<
    string,
    string
  >;

  return c.json({
    result: {
      publicId: row.public_id,
      overallScore: row.overall_score,
      pillars: [
        { pillar: "health", score: row.health_score, interpretation: interpretations.health },
        { pillar: "finance", score: row.finance_score, interpretation: interpretations.finance },
        {
          pillar: "caregiving",
          score: row.caregiving_score,
          interpretation: interpretations.caregiving,
        },
      ],
      gaps: humanizeResultPhrases(JSON.parse(row.gaps_json) as string[]),
      strengths: humanizeResultPhrases(JSON.parse(row.strengths_json) as string[]),
      explainability: JSON.parse(row.explainability_json),
      scoringRulesetVersion: row.scoring_ruleset_version,
      createdAt: row.created_at,
      disclaimer:
        "Đây là điểm chuẩn bị của bạn, không phải kết luận bệnh hay dự đoán tuổi thọ.",
    },
  });
});
