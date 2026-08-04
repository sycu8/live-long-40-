import type { Pillar } from "../constants/product";

export const SCORING_RULESET_VERSION = "v1.0.0";

export type AnswerOption = {
  value: string;
  label: string;
  score: number;
};

export type AssessmentQuestionDef = {
  key: string;
  pillar: Pillar;
  prompt: string;
  helpText?: string;
  whyImportant?: string;
  inputType: "single_choice";
  options: AnswerOption[];
  weight: number;
  required: boolean;
};

/** Deterministic readiness assessment (≈20 questions, <7 minutes). */
export const ASSESSMENT_QUESTIONS: AssessmentQuestionDef[] = [
  {
    key: "age_band",
    pillar: "health",
    prompt: "Bạn thuộc nhóm tuổi nào?",
    whyImportant:
      "Nhóm tuổi giúp ưu tiên các bước chuẩn bị phù hợp, không dùng để dự đoán tuổi thọ.",
    inputType: "single_choice",
    weight: 0.5,
    required: true,
    options: [
      { value: "40-44", label: "40–44", score: 80 },
      { value: "45-49", label: "45–49", score: 75 },
      { value: "50-54", label: "50–54", score: 70 },
      { value: "55-59", label: "55–59", score: 65 },
      { value: "60-plus", label: "60 trở lên", score: 60 },
    ],
  },
  {
    key: "bp_known",
    pillar: "health",
    prompt: "Bạn có biết huyết áp gần nhất của mình không?",
    whyImportant: "Theo dõi huyết áp là thói quen nền tảng cho sức khỏe trung niên.",
    inputType: "single_choice",
    weight: 1.2,
    required: true,
    options: [
      { value: "within_3m", label: "Có, đo trong 3 tháng gần đây", score: 100 },
      { value: "within_year", label: "Có, trong vòng 1 năm", score: 70 },
      { value: "old", label: "Đã lâu rồi, không nhớ rõ", score: 35 },
      { value: "never", label: "Chưa từng đo hoặc không nhớ", score: 10 },
    ],
  },
  {
    key: "checkup_habit",
    pillar: "health",
    prompt: "Bạn khám sức khỏe định kỳ thế nào?",
    inputType: "single_choice",
    weight: 1.3,
    required: true,
    options: [
      { value: "yearly", label: "Ít nhất mỗi năm một lần", score: 100 },
      { value: "2y", label: "Khoảng 2 năm một lần", score: 70 },
      { value: "when_ill", label: "Chỉ khi có triệu chứng", score: 30 },
      { value: "rarely", label: "Rất ít hoặc chưa từng", score: 10 },
    ],
  },
  {
    key: "activity",
    pillar: "health",
    prompt: "Bạn vận động mức vừa phải bao nhiêu ngày mỗi tuần?",
    helpText: "Ví dụ: đi bộ nhanh, đạp xe nhẹ, làm việc nhà năng động.",
    inputType: "single_choice",
    weight: 1.1,
    required: true,
    options: [
      { value: "5plus", label: "5 ngày trở lên", score: 100 },
      { value: "3-4", label: "3–4 ngày", score: 80 },
      { value: "1-2", label: "1–2 ngày", score: 45 },
      { value: "0", label: "Hầu như không", score: 15 },
    ],
  },
  {
    key: "sleep",
    pillar: "health",
    prompt: "Giấc ngủ của bạn trong tuần gần đây thế nào?",
    inputType: "single_choice",
    weight: 0.9,
    required: true,
    options: [
      { value: "good", label: "Ngủ đủ và ổn định", score: 100 },
      { value: "ok", label: "Tạm ổn, đôi khi thiếu ngủ", score: 70 },
      { value: "poor", label: "Thường xuyên thiếu hoặc kém chất lượng", score: 30 },
    ],
  },
  {
    key: "meds_list",
    pillar: "health",
    prompt: "Bạn có danh sách thuốc đang dùng (nếu có) và liều lượng không?",
    inputType: "single_choice",
    weight: 0.8,
    required: true,
    options: [
      { value: "yes_updated", label: "Có và cập nhật gần đây", score: 100 },
      { value: "partial", label: "Có nhưng chưa đầy đủ", score: 55 },
      { value: "no", label: "Chưa có / không dùng thuốc", score: 40 },
    ],
  },
  {
    key: "fall_risk_awareness",
    pillar: "health",
    prompt: "Bạn đã tìm hiểu cách phòng ngã tại nhà chưa?",
    inputType: "single_choice",
    weight: 0.8,
    required: true,
    options: [
      { value: "practiced", label: "Đã áp dụng một số biện pháp", score: 100 },
      { value: "read", label: "Đã đọc nhưng chưa làm", score: 60 },
      { value: "no", label: "Chưa tìm hiểu", score: 20 },
    ],
  },
  {
    key: "emergency_fund",
    pillar: "finance",
    prompt: "Bạn có quỹ dự phòng cho chi phí bất ngờ không?",
    whyImportant: "Quỹ dự phòng giúp giảm phụ thuộc khi có việc đột xuất.",
    inputType: "single_choice",
    weight: 1.4,
    required: true,
    options: [
      { value: "6m", label: "Đủ khoảng 6 tháng chi phí thiết yếu", score: 100 },
      { value: "3m", label: "Đủ khoảng 3 tháng", score: 75 },
      { value: "1m", label: "Dưới 3 tháng", score: 40 },
      { value: "none", label: "Chưa có quỹ riêng", score: 10 },
    ],
  },
  {
    key: "expense_estimate",
    pillar: "finance",
    prompt: "Bạn đã ước lượng chi phí thiết yếu khi về hưu chưa?",
    inputType: "single_choice",
    weight: 1.2,
    required: true,
    options: [
      { value: "written", label: "Có, đã ghi lại cụ thể", score: 100 },
      { value: "rough", label: "Có ước lượng sơ bộ", score: 65 },
      { value: "no", label: "Chưa nghĩ đến", score: 15 },
    ],
  },
  {
    key: "income_sources",
    pillar: "finance",
    prompt: "Bạn nắm rõ các nguồn thu nhập dự kiến sau này chưa?",
    helpText: "Ví dụ: lương hưu, tiết kiệm, hỗ trợ gia đình — chỉ để tự theo dõi, không phải tư vấn đầu tư.",
    inputType: "single_choice",
    weight: 1.1,
    required: true,
    options: [
      { value: "clear", label: "Đã liệt kê rõ", score: 100 },
      { value: "partial", label: "Biết một phần", score: 55 },
      { value: "unclear", label: "Chưa rõ", score: 20 },
    ],
  },
  {
    key: "debt_awareness",
    pillar: "finance",
    prompt: "Bạn theo dõi nợ phải trả (nếu có) thế nào?",
    inputType: "single_choice",
    weight: 0.9,
    required: true,
    options: [
      { value: "tracked", label: "Có danh sách và kế hoạch trả", score: 100 },
      { value: "know", label: "Biết số nợ nhưng chưa có kế hoạch", score: 55 },
      { value: "none", label: "Không có nợ đáng kể", score: 90 },
      { value: "unclear", label: "Chưa nắm rõ", score: 20 },
    ],
  },
  {
    key: "insurance_basic",
    pillar: "finance",
    prompt: "Bạn có bảo hiểm y tế / bảo hiểm xã hội đang hiệu lực không?",
    inputType: "single_choice",
    weight: 1.0,
    required: true,
    options: [
      { value: "yes", label: "Có và đang hiệu lực", score: 100 },
      { value: "unsure", label: "Có nhưng chưa chắc trạng thái", score: 50 },
      { value: "no", label: "Chưa có", score: 15 },
    ],
  },
  {
    key: "docs_ready",
    pillar: "finance",
    prompt: "Giấy tờ quan trọng (CMND/CCCD, sổ BHXH, giấy tờ nhà…) được lưu thế nào?",
    inputType: "single_choice",
    weight: 0.9,
    required: true,
    options: [
      { value: "organized", label: "Gọn gàng, người thân biết chỗ", score: 100 },
      { value: "partial", label: "Có nhưng chưa ngăn nắp", score: 55 },
      { value: "scattered", label: "Phân tán, khó tìm", score: 20 },
    ],
  },
  {
    key: "care_experience",
    pillar: "caregiving",
    prompt: "Bạn đã từng hỗ trợ chăm sóc người lớn tuổi chưa?",
    inputType: "single_choice",
    weight: 1.0,
    required: true,
    options: [
      { value: "regular", label: "Đang hoặc từng chăm sóc thường xuyên", score: 90 },
      { value: "occasional", label: "Thỉnh thoảng hỗ trợ", score: 70 },
      { value: "none", label: "Chưa có kinh nghiệm", score: 35 },
    ],
  },
  {
    key: "fall_response",
    pillar: "caregiving",
    prompt: "Bạn biết nên làm gì khi người thân bị ngã không?",
    whyImportant: "Phản ứng đúng giúp tránh làm nặng thêm chấn thương.",
    inputType: "single_choice",
    weight: 1.3,
    required: true,
    options: [
      { value: "confident", label: "Biết các bước cơ bản và khi nào gọi cấp cứu", score: 100 },
      { value: "partial", label: "Biết một phần", score: 55 },
      { value: "unsure", label: "Chưa chắc", score: 20 },
    ],
  },
  {
    key: "emergency_contacts",
    pillar: "caregiving",
    prompt: "Bạn có danh sách liên hệ khẩn cấp cho bản thân và gia đình không?",
    inputType: "single_choice",
    weight: 1.1,
    required: true,
    options: [
      { value: "shared", label: "Có và đã chia sẻ với người thân", score: 100 },
      { value: "private", label: "Có nhưng chỉ mình biết", score: 65 },
      { value: "none", label: "Chưa có", score: 15 },
    ],
  },
  {
    key: "care_prefs",
    pillar: "caregiving",
    prompt: "Bạn đã trao đổi với gia đình về mong muốn khi cần hỗ trợ y tế chưa?",
    inputType: "single_choice",
    weight: 1.0,
    required: true,
    options: [
      { value: "discussed", label: "Đã trao đổi rõ", score: 100 },
      { value: "started", label: "Mới bắt đầu nói", score: 60 },
      { value: "not_yet", label: "Chưa đề cập", score: 20 },
    ],
  },
  {
    key: "home_safety",
    pillar: "caregiving",
    prompt: "Không gian sống của bạn/người thân có rủi ro ngã rõ ràng không?",
    helpText: "Ví dụ: sàn trơn, thiếu ánh sáng, không có tay vịn.",
    inputType: "single_choice",
    weight: 0.9,
    required: true,
    options: [
      { value: "checked_fixed", label: "Đã kiểm tra và xử lý", score: 100 },
      { value: "checked", label: "Đã kiểm tra, chưa xử lý hết", score: 60 },
      { value: "not_checked", label: "Chưa kiểm tra", score: 20 },
    ],
  },
  {
    key: "med_support",
    pillar: "caregiving",
    prompt: "Bạn có thể hỗ trợ người thân uống thuốc đúng giờ nếu cần không?",
    inputType: "single_choice",
    weight: 0.8,
    required: true,
    options: [
      { value: "system", label: "Có quy trình / nhắc lịch rõ", score: 100 },
      { value: "ad_hoc", label: "Hỗ trợ khi được nhờ", score: 60 },
      { value: "unsure", label: "Chưa sẵn sàng", score: 25 },
    ],
  },
  {
    key: "self_reliance_goal",
    pillar: "finance",
    prompt: "Mức độ bạn muốn tự chủ tài chính và sinh hoạt lâu dài?",
    whyImportant: "Giúp ưu tiên hành động phù hợp với mục tiêu của bạn.",
    inputType: "single_choice",
    weight: 0.7,
    required: true,
    options: [
      { value: "high", label: "Muốn tự chủ cao, giảm phụ thuộc con cái", score: 85 },
      { value: "balanced", label: "Cân bằng giữa tự chủ và hỗ trợ gia đình", score: 75 },
      { value: "learning", label: "Đang tìm hiểu, chưa rõ", score: 50 },
    ],
  },
];

export type ScoreBreakdown = {
  questionKey: string;
  pillar: Pillar;
  answered: boolean;
  rawScore: number | null;
  weight: number;
  contribution: number;
};

export type PillarScore = {
  pillar: Pillar;
  score: number;
  answeredCount: number;
  totalCount: number;
  unansweredKeys: string[];
};

export type ScoringResult = {
  rulesetVersion: string;
  overallScore: number;
  pillars: Record<Pillar, PillarScore>;
  breakdown: ScoreBreakdown[];
  gaps: string[];
  strengths: string[];
  interpretations: Record<Pillar, string>;
};

function interpret(score: number, pillar: Pillar): string {
  const label =
    pillar === "health"
      ? "sức khỏe"
      : pillar === "finance"
        ? "tài chính"
        : "chăm sóc";
  if (score >= 80) {
    return `Bạn đã có nền tảng ${label} khá vững. Tiếp tục duy trì thói quen hiện có.`;
  }
  if (score >= 55) {
    return `Bạn đã bắt đầu chuẩn bị về ${label}, còn một số khoảng trống có thể cải thiện trong 30 ngày tới.`;
  }
  return `Lĩnh vực ${label} còn nhiều chỗ để chuẩn bị. Các hành động nhỏ, đều đặn sẽ giúp bạn tiến bộ rõ hơn.`;
}

const GAP_MESSAGES: Record<string, string> = {
  bp_known: "Chưa nắm huyết áp gần đây",
  checkup_habit: "Chưa có thói quen khám định kỳ",
  activity: "Vận động còn ít",
  emergency_fund: "Quỹ dự phòng chưa đủ",
  expense_estimate: "Chưa ước lượng chi phí về hưu",
  docs_ready: "Giấy tờ quan trọng chưa được sắp xếp",
  fall_response: "Chưa rõ cách xử lý khi người thân bị ngã",
  emergency_contacts: "Thiếu danh sách liên hệ khẩn cấp",
  care_prefs: "Chưa trao đổi mong muốn hỗ trợ với gia đình",
  home_safety: "Chưa kiểm tra an toàn nhà ở",
};

const STRENGTH_MESSAGES: Record<string, string> = {
  bp_known: "Đã theo dõi huyết áp",
  checkup_habit: "Có thói quen khám định kỳ",
  activity: "Duy trì vận động đều",
  emergency_fund: "Có quỹ dự phòng",
  expense_estimate: "Đã ước lượng chi phí",
  docs_ready: "Giấy tờ được lưu ngăn nắp",
  fall_response: "Biết phản ứng khi có người ngã",
  emergency_contacts: "Có danh sách liên hệ khẩn cấp",
  care_prefs: "Đã trao đổi mong muốn với gia đình",
  home_safety: "Đã kiểm tra an toàn nhà ở",
};

export function scoreAssessment(
  answers: Record<string, string>,
  questions: AssessmentQuestionDef[] = ASSESSMENT_QUESTIONS,
): ScoringResult {
  const breakdown: ScoreBreakdown[] = [];
  const pillarAcc: Record<
    Pillar,
    { weighted: number; weightSum: number; answered: number; total: number; unanswered: string[] }
  > = {
    health: { weighted: 0, weightSum: 0, answered: 0, total: 0, unanswered: [] },
    finance: { weighted: 0, weightSum: 0, answered: 0, total: 0, unanswered: [] },
    caregiving: { weighted: 0, weightSum: 0, answered: 0, total: 0, unanswered: [] },
  };

  for (const q of questions) {
    const acc = pillarAcc[q.pillar];
    acc.total += 1;
    const value = answers[q.key];
    if (value == null || value === "") {
      acc.unanswered.push(q.key);
      breakdown.push({
        questionKey: q.key,
        pillar: q.pillar,
        answered: false,
        rawScore: null,
        weight: q.weight,
        contribution: 0,
      });
      continue;
    }
    const option = q.options.find((o) => o.value === value);
    const rawScore = option?.score ?? 0;
    acc.answered += 1;
    acc.weighted += rawScore * q.weight;
    acc.weightSum += q.weight;
    breakdown.push({
      questionKey: q.key,
      pillar: q.pillar,
      answered: true,
      rawScore,
      weight: q.weight,
      contribution: rawScore * q.weight,
    });
  }

  const pillars = {} as Record<Pillar, PillarScore>;
  let overallWeighted = 0;
  let overallWeight = 0;

  for (const pillar of Object.keys(pillarAcc) as Pillar[]) {
    const acc = pillarAcc[pillar];
    const score =
      acc.weightSum > 0 ? Math.round(acc.weighted / acc.weightSum) : 0;
    pillars[pillar] = {
      pillar,
      score,
      answeredCount: acc.answered,
      totalCount: acc.total,
      unansweredKeys: acc.unanswered,
    };
    overallWeighted += acc.weighted;
    overallWeight += acc.weightSum;
  }

  const overallScore =
    overallWeight > 0 ? Math.round(overallWeighted / overallWeight) : 0;

  const gapCandidates = breakdown
    .filter((b) => b.answered && b.rawScore != null && b.rawScore < 55)
    .sort((a, b) => (a.rawScore ?? 0) - (b.rawScore ?? 0));

  const strengthCandidates = breakdown
    .filter((b) => b.answered && b.rawScore != null && b.rawScore >= 80)
    .sort((a, b) => (b.rawScore ?? 0) - (a.rawScore ?? 0));

  const gaps = gapCandidates
    .map((g) => GAP_MESSAGES[g.questionKey] ?? `Cần cải thiện: ${g.questionKey}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 3);

  const strengths = strengthCandidates
    .map((g) => STRENGTH_MESSAGES[g.questionKey] ?? `Điểm mạnh: ${g.questionKey}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 3);

  while (gaps.length < 3) {
    const unanswered = breakdown.find(
      (b) => !b.answered && !gaps.includes(`Chưa trả lời: ${b.questionKey}`),
    );
    if (!unanswered) break;
    gaps.push(`Chưa trả lời: ${unanswered.questionKey}`);
  }

  return {
    rulesetVersion: SCORING_RULESET_VERSION,
    overallScore,
    pillars,
    breakdown,
    gaps,
    strengths,
    interpretations: {
      health: interpret(pillars.health.score, "health"),
      finance: interpret(pillars.finance.score, "finance"),
      caregiving: interpret(pillars.caregiving.score, "caregiving"),
    },
  };
}
