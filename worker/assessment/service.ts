import { ASSESSMENT_QUESTIONS, scoreAssessment } from "@shared/rules/scoring";
import { createId, nowIso } from "@shared/utils/id";

export async function getOrSeedCurrentDefinition(db: D1Database) {
  let def = await db
    .prepare(
      `SELECT id, version, title, description, scoring_ruleset_version
       FROM assessment_definitions WHERE is_current = 1 LIMIT 1`,
    )
    .first<{
      id: string;
      version: string;
      title: string;
      description: string;
      scoring_ruleset_version: string;
    }>();

  if (!def) {
    const id = createId("adef");
    const now = nowIso();
    await db
      .prepare(
        `INSERT INTO assessment_definitions
         (id, version, title, description, scoring_ruleset_version, is_current, created_at)
         VALUES (?, 'v1.0.0', 'Đánh giá mức độ chuẩn bị Sống An 40+', 'Bài đánh giá ngắn về sức khỏe, tiền bạc và chăm sóc', 'v1.0.0', 1, ?)`,
      )
      .bind(id, now)
      .run();

    for (let i = 0; i < ASSESSMENT_QUESTIONS.length; i++) {
      const q = ASSESSMENT_QUESTIONS[i]!;
      await db
        .prepare(
          `INSERT INTO assessment_questions
           (id, definition_id, question_key, sort_order, pillar, prompt, help_text, why_important, input_type, options_json, weight, required)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          createId("aq"),
          id,
          q.key,
          i + 1,
          q.pillar,
          q.prompt,
          q.helpText ?? null,
          q.whyImportant ?? null,
          q.inputType,
          JSON.stringify(q.options),
          q.weight,
          q.required ? 1 : 0,
        )
        .run();
    }

    def = {
      id,
      version: "v1.0.0",
      title: "Đánh giá mức độ chuẩn bị Sống An 40+",
      description: "Bài đánh giá ngắn về sức khỏe, tiền bạc và chăm sóc",
      scoring_ruleset_version: "v1.0.0",
    };
  }

  const questions = await db
    .prepare(
      `SELECT id, question_key, sort_order, pillar, prompt, help_text, why_important, input_type, options_json, weight, required
       FROM assessment_questions WHERE definition_id = ? ORDER BY sort_order ASC`,
    )
    .bind(def.id)
    .all<{
      id: string;
      question_key: string;
      sort_order: number;
      pillar: string;
      prompt: string;
      help_text: string | null;
      why_important: string | null;
      input_type: string;
      options_json: string;
      weight: number;
      required: number;
    }>();

  return { definition: def, questions: questions.results ?? [] };
}

export async function getAnswersMap(db: D1Database, runId: string) {
  const rows = await db
    .prepare(
      `SELECT q.question_key as question_key, a.answer_value as answer_value
       FROM assessment_answers a
       JOIN assessment_questions q ON q.id = a.question_id
       WHERE a.run_id = ?`,
    )
    .bind(runId)
    .all<{ question_key: string; answer_value: string }>();
  const map: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    map[row.question_key] = row.answer_value;
  }
  return map;
}

export function computeScores(answers: Record<string, string>) {
  return scoreAssessment(answers);
}
