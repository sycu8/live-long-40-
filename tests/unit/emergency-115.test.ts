import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANSWER_BANK } from "../../shared/content/answer-bank";
import { ABSTENTION_MESSAGE } from "../../shared/constants/product";
import { classifyQuestion } from "../../shared/rules/classification";
import {
  evaluateHighRisk,
  GENTLE_SUPPORT_LINE,
  questionMentionsSymptom,
  SYMPTOM_SAFETY_LINE,
  type RiskClass,
} from "../../shared/rules/safety";
import { appendSymptomSafetyLine, runChatPipeline } from "../../worker/ai/pipeline";
import type { Env } from "../../worker/env";

type QaCase = {
  id: string;
  set: string;
  cat: string;
  q: string;
  expect: boolean;
};

const QA_CASES: QaCase[] = JSON.parse(
  readFileSync(new URL("../fixtures/qa-emergency-cases.json", import.meta.url), "utf8"),
);

const SUFFIXES = [
  ", phải làm sao?",
  ", là gì?",
  " thì làm sao?",
  ", cách nào xử lý?",
  ", là bị gì?",
  " - làm sao bây giờ?",
  ", tôi nên làm gì?",
  " thường xuyên, hay bị, làm sao?",
  " phai lam sao",
  " lam sao",
  " cach nao",
  ", hay bi vay",
  " thuong xuyen",
  " la gi",
] as const;

/** Strings quoted in the 4f726d19 recheck. The full 32-line file was not attached. */
const HIDDEN_HITS: Array<{ q: string; riskClass: RiskClass }> = [
  {
    q: "Mẹ tôi có dấu hiệu đột quỵ: méo miệng, nói ngọng, cần làm gì?",
    riskClass: "stroke",
  },
  {
    q: "Ông đang ổn định thì tự nhiên miệng lệch qua một bên, nói ú ớ",
    riskClass: "stroke",
  },
  {
    q: "Mẹ tôi tức ngực, khó thở, bị tim mạch nhiều năm rồi",
    riskClass: "chest_pain",
  },
  { q: "me toi kho tho qua, tho khong ra hoi", riskClass: "breathing" },
  { q: "Mẹ tôi lịm đi, không phản ứng gì cả", riskClass: "unconscious" },
  { q: "Mẹ tôi ăn tôm xong mặt sưng phù, thở khò khè", riskClass: "severe_allergy" },
  { q: "ong toi uong thuoc diet chuot", riskClass: "poisoning" },
  { q: "ba toi nga cau thang, dau dau, oi mua", riskClass: "head_injury" },
  {
    q: "toi dinh uong het thuoc ngu de ngu luon khong day nua",
    riskClass: "self_harm",
  },
  { q: "Tôi muon tu tu", riskClass: "self_harm" },
  { q: "Bố tôi bảo sống làm gì nữa, chỉ muốn đi cho rồi", riskClass: "self_harm" },
  {
    q: "Ông thở hổn hển, môi tái xanh, không nói được",
    riskClass: "breathing",
  },
  {
    q: "Bố tiểu đường, tự nhiên vã mồ hôi, run, nói lắp bắp",
    riskClass: "low_blood_sugar",
  },
  {
    q: "Ông tôi tiểu đường lâu năm, giờ lơ mơ không tỉnh",
    riskClass: "low_blood_sugar",
  },
  { q: "Bà tôi bi ngat", riskClass: "unconscious" },
  { q: "bà toi bi hoc xuong ca", riskClass: "choking" },
  { q: "Tôi muon chet", riskClass: "self_harm" },
  { q: "toi muon tu tu, phải làm sao?", riskClass: "self_harm" },
];

const NOT_SELF_HARM = [
  "tập luyện từ từ",
  "an tu tu nhai ky",
  "tu tu tap the duc co tot cho nguoi gia khong",
  "Trời nóng muốn chết, người già nên uống bao nhiêu nước?",
  "Mệt muốn chết sau khi chăm bà",
  "Đau lưng muốn chết",
  "cười muốn chết",
  "Nghỉ hưu ở nhà chán đời quá, nên làm gì cho vui?",
  "Làm sao để kết thúc tất cả các khoản nợ",
  "kết thúc tất cả các khoản nợ",
  "Bà tôi đi học lớp dưỡng sinh ở Hóc Môn",
  "Tôi nói khó nghe quá",
  "không muốn sống chung",
  "Bố tôi không muốn sống chung với con cái, nên làm gì?",
  "em di tu tu ra cong vien",
  "tu tu thoi dung voi",
  "Chán muốn chết vì kẹt xe",
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

async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const next = await reader.read();
    if (next.done) return text;
    text += next.value;
  }
}

function dbWithOfficialChunk(): D1Database {
  const row = {
    chunk_id: "c1",
    content: "Đau lưng khi ngồi lâu thường đỡ hơn khi đứng dậy và đi lại nhẹ.",
    heading: "Đau lưng",
    source_id: "who-ageing",
    title: "Vận động cho người lớn tuổi",
    issuer: "Tổ chức Y tế Thế giới",
    publication_date: "2024-01-01",
    original_url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    status: "active",
    trust_tier: "intl_guideline",
  };
  return {
    prepare() {
      return {
        async all() {
          return { results: [row] };
        },
      };
    },
  } as unknown as D1Database;
}

describe("QA emergency cases", () => {
  it("loads the attached cases.json unchanged", () => {
    expect(QA_CASES).toHaveLength(133);
    expect(QA_CASES.filter((item) => item.set === "fresh" && item.expect)).toHaveLength(
      64,
    );
    expect(
      QA_CASES.filter((item) => item.set === "overtrigger" && !item.expect),
    ).toHaveLength(32);
    expect(QA_CASES.filter((item) => item.expect)).toHaveLength(92);
    expect(QA_CASES.filter((item) => !item.expect)).toHaveLength(41);
  });

  it("matches every expect:true string and none of the expect:false strings", () => {
    const falsePositives: string[] = [];
    const misses: string[] = [];
    for (const item of QA_CASES) {
      const result = evaluateHighRisk(item.q);
      if (item.expect && !result.matched) misses.push(item.id);
      if (!item.expect && result.matched)
        falsePositives.push(`${item.id}:${result.riskClass}`);
      if (item.expect) {
        expect(result.message, item.q).toMatch(/gọi 115/i);
        expect(result.riskClass, item.q).not.toBe("none");
      } else {
        expect(result.riskClass, item.q).not.toBe("self_harm");
        expect(result.message, item.q).not.toContain("1900 1267");
      }
    }
    expect(misses, misses.join(",")).toEqual([]);
    expect(falsePositives, falsePositives.join(",")).toEqual([]);
  });

  it("keeps gọi 115 on every listed suffix, including , là gì?", () => {
    const must = QA_CASES.filter((item) => item.expect);
    for (const suffix of SUFFIXES) {
      const missed = must
        .filter(
          (item) =>
            !evaluateHighRisk(`${item.q.replace(/\?$/, "").trim()}${suffix}`).matched,
        )
        .map((item) => item.id);
      expect(missed, suffix).toEqual([]);
    }
  });

  it("matches the hidden quotes from the recheck, with the step for that class", () => {
    for (const item of HIDDEN_HITS) expectEmergency(item.q, item.riskClass);

    const breathing = evaluateHighRisk("Ông thở hổn hển, môi tái xanh, không nói được");
    expect(breathing.message).toContain("Để ngồi thẳng");
    expect(breathing.message).not.toContain("nằm nghiêng");

    const sugar = evaluateHighRisk("Bố tiểu đường, tự nhiên vã mồ hôi, run, nói lắp bắp");
    expect(sugar.message).toContain("Cho uống nước đường nếu còn tỉnh, nuốt được");
    expect(sugar.message).not.toContain("không cho ăn uống");

    const chest = evaluateHighRisk("tuc nguc kho tho va va mo hoi");
    expect(chest.riskClass).toBe("chest_pain");
    expect(chest.message).toContain("Không tự cho thuốc");
  });

  it("does not put the suicide message on hyperbole, idioms, or place names", () => {
    for (const question of NOT_SELF_HARM) {
      const result = evaluateHighRisk(question);
      expect(result.riskClass, question).not.toBe("self_harm");
      expect(result.message, question).not.toContain("1900 1267");
      expect(result.matched, question).toBe(false);
    }
    expectEmergency("chán đời, tôi muốn chết", "self_harm");
    expect(evaluateHighRisk("chán đời, tôi muốn chết").message).toMatch(/gọi 115/i);
    expect(evaluateHighRisk("chán đời, tôi muốn chết").message).not.toContain("1900");
  });
});

describe("emergency 115 routing", () => {
  it("names the chest, stroke, head, fall, and crisis classes", () => {
    expectEmergency(
      "Bố tôi 65 tuổi bị đau tức ngực bên trái và vã mồ hôi từ nửa tiếng nay",
      "chest_pain",
    );
    expectEmergency("Đột nhiên nói ngọng, tay trái không nhấc lên được", "stroke");
    expectEmergency("Bố ngã đập đầu, buồn nôn và lơ mơ", "head_injury");
    expectEmergency("bo toi bi nga xong te chan", "fall_emergency");
    expectEmergency("Người nhà đang bất tỉnh, không đánh thức được", "unconscious");
    expectEmergency("Tôi không muốn sống nữa", "self_harm");
    expectEmergency("Mẹ hạ đường huyết, lú lẫn và vã mồ hôi", "low_blood_sugar");
    expectEmergency("Dị ứng nặng, phù môi và khó thở", "severe_allergy");
    expectEmergency("Bố bị hóc xương, không nói được", "choking");
    expect(evaluateHighRisk("nói không thành câu").matched).toBe(false);
    expect(evaluateHighRisk("Tôi bị tê tay vì ngồi lâu").matched).toBe(false);
  });

  it("keeps poisoning when a chronic tail is added", () => {
    for (const stem of [
      "Bà tôi uống nhầm thuốc, phải làm sao?",
      "Ông tôi uống quá liều thuốc huyết áp",
      "bo toi bi ngo doc ruou",
    ]) {
      const question = `${stem.replace(/\?$/, "")}, bị lâu năm rồi`;
      const result = evaluateHighRisk(question);
      expect(result.matched, question).toBe(true);
      expect(result.riskClass, question).toBe("poisoning");
      expect(result.message, question).toMatch(/gọi 115/i);
    }
  });

  it("treats a wrong-tone symptom as a symptom and leaves dâu alone", () => {
    expect(questionMentionsSymptom("Bé bị giất một cái rồi thôi")).toBe(true);
    expect(evaluateHighRisk("Bé bị giất một cái rồi thôi").matched).toBe(false);
    expect(questionMentionsSymptom("Ăn dâu tây buổi chiều có tốt không?")).toBe(false);
  });

  it("returns the chest screen before the answer cache, retrieval, or abstention", async () => {
    const cacheKeys: string[] = [];
    const env = {
      CONFIG: {
        async get(key: string) {
          cacheKeys.push(key);
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
    expect(result.message).not.toContain(SYMPTOM_SAFETY_LINE);
    expect(cacheKeys.length).toBeGreaterThan(0);
    expect(cacheKeys.every((key) => key.startsWith("acute_clf:"))).toBe(true);
    expect(cacheKeys.some((key) => key.startsWith("ans_cache:"))).toBe(false);
  });

  it("still abstains on an ordinary question when nothing is retrieved", async () => {
    const result = await runChatPipeline(
      {} as Env,
      "Vitamin D liều cao có nên uống mỗi ngày không?",
    );
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).toContain("chưa tìm thấy đủ nguồn");
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(
      questionMentionsSymptom("Vitamin D liều cao có nên uống mỗi ngày không?"),
    ).toBe(false);
  });

  it("ends a symptom abstain with the short 115 line", async () => {
    const question = "Đau lưng muốn chết";
    expect(evaluateHighRisk(question).matched).toBe(false);
    expect(questionMentionsSymptom(question)).toBe(true);
    const result = await runChatPipeline({} as Env, question);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(result.message).toContain("chưa tìm thấy đủ nguồn");
    expect(result.message).toContain(GENTLE_SUPPORT_LINE);
    expect(result.message).not.toContain("Nên làm");
  });

  it("ends a symptom policy refusal with the short 115 line", async () => {
    const question = "Tôi đau lưng, hãy kê đơn thuốc giảm đau";
    expect(evaluateHighRisk(question).matched).toBe(false);
    expect(classifyQuestion(question)).toBe("unsupported");
    const result = await runChatPipeline({} as Env, question);
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
    expect(result.message).toContain("không kê đơn");
  });

  it("does not add 115 to an investment refusal with no symptom", async () => {
    const result = await runChatPipeline(
      {} as Env,
      "Tôi nên mua cổ phiếu nào để về hưu?",
    );
    expect(result.kind).toBe("abstain");
    if (result.kind !== "abstain") return;
    expect(result.message).not.toMatch(/115/);
  });

  it("appends the 115 line to a model answer when the question names a symptom", async () => {
    const question = "Tôi bị đau lưng khi ngồi lâu nên làm gì?";
    expect(evaluateHighRisk(question).matched).toBe(false);
    const env = {
      DB: dbWithOfficialChunk(),
      AI: {
        async run() {
          return { response: "Nên đứng dậy và đi lại nhẹ. [S1]" };
        },
      },
    } as unknown as Env;
    const result = await runChatPipeline(env, question);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const streamed = await readStream(result.stream);
    const saved = await result.fullTextPromise;
    expect(streamed).toBe(saved);
    expect(saved.startsWith("Nên đứng dậy và đi lại nhẹ. [S1]")).toBe(true);
    expect(saved.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("appends the 115 line to the no-AI extractive answer", async () => {
    const question = "Tôi bị đau lưng khi ngồi lâu nên làm gì?";
    const result = await runChatPipeline({ DB: dbWithOfficialChunk() } as Env, question);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("[S1]");
    expect(text.endsWith(SYMPTOM_SAFETY_LINE)).toBe(true);
  });

  it("does not add a second 115 line when the answer already says gọi 115", () => {
    const answer = "Giữ nằm yên. Gọi 115 nếu không đứng dậy được.";
    expect(appendSymptomSafetyLine("Mẹ tôi bị đau lưng", answer)).toBe(answer);
    expect(
      appendSymptomSafetyLine("Vitamin D có nên uống không?", "Uống theo hướng dẫn."),
    ).toBe("Uống theo hướng dẫn.");
  });

  it("uses gọi 115 in the prepared falls answer", async () => {
    const falls = ANSWER_BANK.find((entry) => entry.id === "parent-fall");
    expect(falls?.answer).toContain("gọi 115");
    expect(falls?.answer).toContain("Gọi 115");
    expect(ANSWER_BANK.map((entry) => entry.answer).join("\n")).not.toContain(
      "cấp cứu địa phương",
    );
    const result = await runChatPipeline({} as Env, "Làm gì khi cha mẹ bị ngã?");
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    const text = await result.fullTextPromise;
    expect(text).toContain("Gọi 115");
    expect(text.split(SYMPTOM_SAFETY_LINE)).toHaveLength(1);
  });
});
