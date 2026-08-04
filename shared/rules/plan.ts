import type { Pillar } from "../constants/product";
import {
  assessmentTopicLabel,
  type ScoringResult,
} from "./scoring";

export const PLAN_RULESET_VERSION = "v1.0.1";

export type PlanActionTemplate = {
  actionKey: string;
  title: string;
  description: string;
  reason: string;
  effortMinutes: number;
  pillar: Pillar;
  sourceRef: string;
  lessonSlug?: string;
  /** Lower score on related questions increases priority */
  triggerQuestionKeys: string[];
  maxScoreToTrigger: number;
};

export const ACTION_CATALOG: PlanActionTemplate[] = [
  {
    actionKey: "record_bp",
    title: "Ghi lại lần đo huyết áp gần nhất",
    description: "Ghi ngày đo, chỉ số và nơi đo vào một tờ giấy hoặc sổ tay.",
    reason: "Bạn chưa nắm rõ huyết áp gần đây.",
    effortMinutes: 10,
    pillar: "health",
    sourceRef: "lesson:theo-doi-huyet-ap",
    lessonSlug: "theo-doi-huyet-ap",
    triggerQuestionKeys: ["bp_known"],
    maxScoreToTrigger: 70,
  },
  {
    actionKey: "walk_20",
    title: "Đi bộ 20 phút trong 3 ngày",
    description: "Chọn tốc độ thoải mái. Có thể chia thành các phiên ngắn hơn.",
    reason: "Tăng vận động nhẹ giúp duy trì sức khỏe lâu dài.",
    effortMinutes: 60,
    pillar: "health",
    sourceRef: "lesson:van-dong-trung-nien",
    lessonSlug: "van-dong-trung-nien",
    triggerQuestionKeys: ["activity"],
    maxScoreToTrigger: 80,
  },
  {
    actionKey: "book_checkup",
    title: "Lên lịch khám sức khỏe định kỳ",
    description: "Ghi nhớ hoặc đặt lịch khám tổng quát tại cơ sở bạn tin tưởng.",
    reason: "Khám định kỳ giúp phát hiện sớm các vấn đề thường gặp.",
    effortMinutes: 20,
    pillar: "health",
    sourceRef: "lesson:kham-dinh-ky",
    lessonSlug: "kham-dinh-ky",
    triggerQuestionKeys: ["checkup_habit"],
    maxScoreToTrigger: 70,
  },
  {
    actionKey: "estimate_expenses",
    title: "Ước lượng chi phí thiết yếu khi về hưu",
    description: "Liệt kê ăn uống, nhà ở, thuốc men, đi lại theo tháng.",
    reason: "Ước lượng chi phí là bước đầu để chuẩn bị tài chính.",
    effortMinutes: 30,
    pillar: "finance",
    sourceRef: "lesson:chi-phi-ve-huu",
    lessonSlug: "chi-phi-ve-huu",
    triggerQuestionKeys: ["expense_estimate"],
    maxScoreToTrigger: 65,
  },
  {
    actionKey: "emergency_fund_start",
    title: "Đặt mục tiêu quỹ dự phòng tháng này",
    description: "Chọn một số tiền nhỏ, thực tế và tách riêng nếu có thể.",
    reason: "Quỹ dự phòng giúp giảm áp lực khi có việc đột xuất.",
    effortMinutes: 25,
    pillar: "finance",
    sourceRef: "lesson:quy-du-phong",
    lessonSlug: "quy-du-phong",
    triggerQuestionKeys: ["emergency_fund"],
    maxScoreToTrigger: 75,
  },
  {
    actionKey: "organize_docs",
    title: "Sắp xếp một bộ giấy tờ quan trọng",
    description: "Gom CCCD, sổ BHXH/BHYT và giấy tờ nhà vào một chỗ dễ tìm.",
    reason: "Giấy tờ ngăn nắp giúp gia đình hỗ trợ nhanh khi cần.",
    effortMinutes: 40,
    pillar: "finance",
    sourceRef: "lesson:giay-to-tuoi-gia",
    lessonSlug: "giay-to-tuoi-gia",
    triggerQuestionKeys: ["docs_ready"],
    maxScoreToTrigger: 55,
  },
  {
    actionKey: "emergency_contacts",
    title: "Tạo danh sách liên hệ khẩn cấp",
    description: "Ghi 3–5 số điện thoại quan trọng và để ở nơi dễ thấy.",
    reason: "Danh sách liên hệ giúp phản ứng nhanh khi có sự cố.",
    effortMinutes: 15,
    pillar: "caregiving",
    sourceRef: "lesson:lien-he-khan-cap",
    lessonSlug: "lien-he-khan-cap",
    triggerQuestionKeys: ["emergency_contacts"],
    maxScoreToTrigger: 65,
  },
  {
    actionKey: "fall_lesson",
    title: "Hoàn thành bài học ngắn về phòng ngã",
    description: "Đọc bài trong Thư viện và ghi 2 thay đổi nhỏ tại nhà.",
    reason: "Phòng ngã là kỹ năng chăm sóc thực tế, dễ áp dụng.",
    effortMinutes: 20,
    pillar: "caregiving",
    sourceRef: "lesson:phong-nga",
    lessonSlug: "phong-nga",
    triggerQuestionKeys: ["fall_response", "fall_risk_awareness", "home_safety"],
    maxScoreToTrigger: 60,
  },
  {
    actionKey: "family_prefs",
    title: "Trao đổi mong muốn khẩn cấp với một người thân",
    description: "Nói ngắn gọn về người cần gọi và nơi lưu giấy tờ.",
    reason: "Gia đình hiểu mong muốn sẽ hỗ trợ tốt hơn khi cần.",
    effortMinutes: 20,
    pillar: "caregiving",
    sourceRef: "lesson:trao-doi-gia-dinh",
    lessonSlug: "trao-doi-gia-dinh",
    triggerQuestionKeys: ["care_prefs"],
    maxScoreToTrigger: 60,
  },
  {
    actionKey: "med_list",
    title: "Lập danh sách thuốc đang dùng",
    description: "Ghi tên thuốc, liều và bác sĩ kê đơn (nếu có).",
    reason: "Danh sách thuốc giúp tránh nhầm lẫn khi khám hoặc cấp cứu.",
    effortMinutes: 15,
    pillar: "health",
    sourceRef: "lesson:danh-sach-thuoc",
    lessonSlug: "danh-sach-thuoc",
    triggerQuestionKeys: ["meds_list"],
    maxScoreToTrigger: 55,
  },
  {
    actionKey: "sleep_routine",
    title: "Chọn giờ ngủ cố định trong 4 đêm",
    description: "Giữ cùng khung giờ đi ngủ và thức dậy.",
    reason: "Giấc ngủ ổn định hỗ trợ sức khỏe tinh thần và thể chất.",
    effortMinutes: 10,
    pillar: "health",
    sourceRef: "lesson:giac-ngu",
    lessonSlug: "giac-ngu",
    triggerQuestionKeys: ["sleep"],
    maxScoreToTrigger: 70,
  },
  {
    actionKey: "income_map",
    title: "Liệt kê nguồn thu nhập dự kiến",
    description: "Ghi các nguồn bạn biết (lương hưu, tiết kiệm…). Không cần số chính xác.",
    reason: "Nhìn rõ nguồn thu giúp bạn chủ động hơn.",
    effortMinutes: 25,
    pillar: "finance",
    sourceRef: "lesson:nguon-thu",
    lessonSlug: "nguon-thu",
    triggerQuestionKeys: ["income_sources"],
    maxScoreToTrigger: 55,
  },
];

export type GeneratedAction = PlanActionTemplate & {
  weekNumber: number;
  isOptional: boolean;
  sortOrder: number;
  selectionReason: string;
};

export type GeneratedPlan = {
  rulesetVersion: string;
  title: string;
  summary: string;
  actions: GeneratedAction[];
};

function scoreForKeys(
  result: ScoringResult,
  keys: string[],
): number {
  const scores = result.breakdown
    .filter((b) => keys.includes(b.questionKey) && b.rawScore != null)
    .map((b) => b.rawScore as number);
  if (scores.length === 0) return 100;
  return Math.min(...scores);
}

function formatTopicList(keys: string[]): string {
  const labels = [...new Set(keys.map((key) => assessmentTopicLabel(key)))];
  if (labels.length === 0) return "các bước chuẩn bị của bạn";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} và ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} và ${labels.at(-1)}`;
}

/** User-facing explanation — Vietnamese only, no raw keys/scores/versions. */
export function buildSelectionReason(
  action: PlanActionTemplate,
  triggerScore: number,
): string {
  const topics = formatTopicList(action.triggerQuestionKeys);
  if (triggerScore <= action.maxScoreToTrigger) {
    return `${action.reason} Được ưu tiên vì còn khoảng trống liên quan đến ${topics}.`;
  }
  return `${action.reason} Giúp củng cố phần ${topics} trong kế hoạch 30 ngày.`;
}

export function humanizePlanReason(
  reason: string,
  actionKey?: string,
): string {
  const looksTechnical =
    /điểm liên quan|quy tắc\s*v?\d|Hành động bổ sung để đủ lịch/i.test(reason) ||
    /\(([a-z][a-z0-9_]*)(,\s*[a-z][a-z0-9_]*)*\)/.test(reason) ||
    /=\s*\d+/.test(reason);

  if (!looksTechnical) return reason;

  const baseKey = actionKey?.replace(/_w\d+_\d+$/, "") ?? "";
  const template =
    ACTION_CATALOG.find((a) => a.actionKey === baseKey) ??
    ACTION_CATALOG.find((a) => actionKey?.startsWith(a.actionKey));
  if (template) {
    return buildSelectionReason(template, 0);
  }
  return "Việc này phù hợp với mức độ sẵn sàng hiện tại của bạn trong kế hoạch 30 ngày.";
}

export function generateThirtyDayPlan(result: ScoringResult): GeneratedPlan {
  const ranked = ACTION_CATALOG.map((action) => {
    const triggerScore = scoreForKeys(result, action.triggerQuestionKeys);
    const priority =
      triggerScore <= action.maxScoreToTrigger
        ? action.maxScoreToTrigger - triggerScore + 10
        : Math.max(0, 40 - triggerScore / 3);
    return { action, triggerScore, priority };
  }).sort((a, b) => b.priority - a.priority);

  const selected = ranked.slice(0, 12);
  const actions: GeneratedAction[] = [];

  for (let week = 1; week <= 4; week++) {
    const weekSlice = selected.slice((week - 1) * 3, week * 3);
    weekSlice.forEach((item, idx) => {
      actions.push({
        ...item.action,
        weekNumber: week,
        isOptional: idx === 2,
        sortOrder: idx,
        selectionReason: buildSelectionReason(item.action, item.triggerScore),
      });
    });
  }

  // Ensure 2 default + 1 optional per week even if catalog short
  while (actions.length < 12) {
    const week = Math.floor(actions.length / 3) + 1;
    const idx = actions.length % 3;
    const fallback = ACTION_CATALOG[actions.length % ACTION_CATALOG.length]!;
    actions.push({
      ...fallback,
      actionKey: `${fallback.actionKey}_w${week}_${idx}`,
      weekNumber: week,
      isOptional: idx === 2,
      sortOrder: idx,
      selectionReason: `${fallback.reason} Bổ sung để đủ lịch trình 30 ngày của bạn.`,
    });
  }

  return {
    rulesetVersion: PLAN_RULESET_VERSION,
    title: "Kế hoạch 30 ngày của bạn",
    summary:
      "Hai việc chính và một việc tùy chọn mỗi tuần. Làm đều đặn quan trọng hơn làm nhiều.",
    actions,
  };
}
