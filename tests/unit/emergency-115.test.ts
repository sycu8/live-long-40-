import { describe, expect, it } from "vitest";
import { ANSWER_BANK } from "../../shared/content/answer-bank";
import { ABSTENTION_MESSAGE } from "../../shared/constants/product";
import { classifyQuestion } from "../../shared/rules/classification";
import { evaluateHighRisk, type RiskClass } from "../../shared/rules/safety";
import { runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

/** QA red-flag set. R09 (prevention / chronic numbness) is a look-alike, not a hit. */
const QA_RED_FLAGS = [
  "Mẹ tôi vừa ngã, giờ tê một bên chân",
  "Bố ngã cầu thang và không cử động được chân",
  "Tôi bị đau ngực dữ dội lan ra cánh tay trái",
  "Bố tôi 65 tuổi bị đau tức ngực bên trái và vã mồ hôi từ nửa tiếng nay",
  "Mẹ bị méo miệng, nói ngọng và yếu một bên tay",
  "Đột nhiên nói ngọng, tay trái không nhấc lên được",
  "Bố ngã đập đầu, buồn nôn và lơ mơ",
  "bo toi bi nga xong te chan",
  "Người nhà đang bất tỉnh, không đánh thức được",
] as const;

/** Accented and unaccented variants beyond the nine QA cases. */
const EXTRA_PHRASINGS = [
  "dau tuc nguc ben trai va va mo hoi tu nua tieng nay",
  "Đột nhiên méo miệng, nói ngọng và yếu nửa người",
  "dot nhien meo mieng noi ngong yeu nua nguoi",
  "Bố ngã đập đầu, bị lú lẫn, nôn và lơ mơ",
  "bo nga dap dau bi lu lan non va lo mo",
  "Chan dang chay mau nhieu khong cam duoc",
  "Bố bị nghẹn, không thở được",
  "Người nhà đang co giật",
  "nguoi nha dang co giat",
  "Tôi không muốn sống nữa",
  "toi muon tu tu",
] as const;

const LOOKALIKES = [
  "Tiểu đường hay tê chân thì làm sao phòng ngã?",
  "tieu duong hay te chan thi lam sao phong nga",
  "Làm gì khi cha mẹ bị ngã nhẹ và vẫn tỉnh?",
  "Từ tuổi 40 tôi nên kiểm tra sức khỏe gì?",
  "Đau ngực khi gắng sức thì nên đi khám định kỳ thế nào?",
  "Dấu hiệu đột quỵ là gì và phòng thế nào?",
  "Tôi bị tê tay vì ngồi lâu",
  "Người bị động kinh hay co giật thì phòng ngã thế nào?",
  "Làm sao để ngủ ngon hơn ở tuổi ngoài 40?",
] as const;

function expectEmergency(question: string, riskClass?: RiskClass) {
  const result = evaluateHighRisk(question);
  expect(result.matched, question).toBe(true);
  expect(result.message, question).toMatch(/gọi 115/i);
  expect(result.message, question).toContain("Nên làm:");
  expect(result.message, question).toContain("Không nên:");
  expect(result.message, question).toContain("không chẩn đoán");
  expect(result.message, question).not.toContain("cấp cứu địa phương");
  expect(result.message, question).not.toContain("chưa tìm thấy đủ nguồn");
  if (riskClass) expect(result.riskClass, question).toBe(riskClass);
  expect(classifyQuestion(question), question).toBe("high_risk_health");
}

describe("emergency 115 routing", () => {
  it("sends every QA red-flag case to 115", () => {
    expect(QA_RED_FLAGS).toHaveLength(9);
    for (const question of QA_RED_FLAGS) expectEmergency(question);
  });

  it("sends the extra chest, stroke, and head-injury phrasings to 115", () => {
    expect(EXTRA_PHRASINGS.length).toBeGreaterThanOrEqual(3);
    for (const question of EXTRA_PHRASINGS) expectEmergency(question);
  });

  it("names the chest, stroke, head, and crisis classes", () => {
    expectEmergency(
      "Bố tôi 65 tuổi bị đau tức ngực bên trái và vã mồ hôi từ nửa tiếng nay",
      "chest_pain",
    );
    expectEmergency("Đột nhiên nói ngọng, tay trái không nhấc lên được", "stroke");
    expectEmergency("Bố ngã đập đầu, buồn nôn và lơ mơ", "head_injury");
    expectEmergency("bo toi bi nga xong te chan", "fall_emergency");
    expectEmergency("Người nhà đang bất tỉnh, không đánh thức được", "unconscious");
    expectEmergency("Tôi không muốn sống nữa", "self_harm");
    expect(evaluateHighRisk("Tôi không muốn sống nữa").message).toContain("1900 1267");
    expect(evaluateHighRisk("Tôi không muốn sống nữa").message).toMatch(/gọi 115/i);
  });

  it("does not treat chronic or prevention look-alikes as emergencies", () => {
    expect(LOOKALIKES.length).toBeGreaterThanOrEqual(5);
    for (const question of LOOKALIKES) {
      const result = evaluateHighRisk(question);
      expect(result.matched, question).toBe(false);
      expect(result.message, question).toBe("");
    }
  });

  it("returns 115 before cache, retrieval, abstention, or the model", async () => {
    let cacheReads = 0;
    const env = {
      CONFIG: {
        async get() {
          cacheReads += 1;
          return JSON.stringify({
            answer: "Đứng dậy ngay và đi lại. gọi cấp cứu địa phương.",
            sources: [],
            classification: "caregiving",
          });
        },
        async put() {
          throw new Error("emergency answers must not be cached");
        },
      },
      DB: {
        prepare() {
          throw new Error("retrieval must not run before the 115 decision");
        },
      },
      AI: {
        async run() {
          throw new Error("the model must not run on a red flag");
        },
      },
    } as unknown as Env;

    const result = await runChatPipeline(
      env,
      "Bố tôi 65 tuổi bị đau tức ngực bên trái và vã mồ hôi từ nửa tiếng nay",
    );

    expect(result.kind).toBe("high_risk");
    if (result.kind !== "high_risk") return;
    expect(result.riskClass).toBe("chest_pain");
    expect(result.message).toMatch(/gọi 115/i);
    expect(result.message).not.toContain(ABSTENTION_MESSAGE);
    expect(cacheReads).toBe(0);
  });

  it("still abstains on an ordinary question when nothing is retrieved", async () => {
    const result = await runChatPipeline(
      {} as Env,
      "Vitamin D liều cao có nên uống mỗi ngày không?",
    );
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain("chưa tìm thấy đủ nguồn");
  });

  it("uses gọi 115 in the prepared falls answer", () => {
    const falls = ANSWER_BANK.find((entry) => entry.id === "parent-fall");
    expect(falls?.answer).toContain("gọi 115");
    expect(falls?.answer).toContain("Gọi 115");
    expect(ANSWER_BANK.map((entry) => entry.answer).join("\n")).not.toContain(
      "cấp cứu địa phương",
    );
  });
});
