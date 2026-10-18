import { describe, expect, it } from "vitest";
import {
  answerAttributionsMatchSources,
  writeAnswerCache,
  type CachedSource,
} from "../../worker/ai/answer-cache";
import type { Env } from "../../worker/env";

const QUESTION = "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe";

const WALKING: CachedSource = {
  key: "S1",
  title: "Đi bộ buổi sáng cho người 61 tuổi",
  issuer: "Tổ chức Y tế Thế giới",
  url: "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
  snippet:
    "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn.",
  score: 0.9,
  trustTier: "intl_guideline",
  status: "active",
};

const SUPPORTED =
  "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn của tổ chức. [S1]";

const FLU =
  "Kháng sinh giúp phòng cúm mùa ở người lớn tuổi. Ở bán cầu bắc nên tiêm vắc xin từ tháng 10 đến tháng 3 mỗi năm. [S1]";

function memoryConfig() {
  const puts: { key: string; value: string }[] = [];
  const CONFIG = {
    async get() {
      return null;
    },
    async put(key: string, value: string) {
      puts.push({ key, value });
    },
  };
  return { puts, CONFIG };
}

describe("answer cache source relevance", () => {
  it("caches a cited answer that overlaps its source", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: SUPPORTED,
      sources: [WALKING],
    });
    expect(SUPPORTED.length).toBeGreaterThanOrEqual(80);
    expect(puts).toHaveLength(1);
  });

  it("does not cache a claim the cited source does not support", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: FLU,
      sources: [{ ...WALKING, score: 0.9 }],
    });
    expect(FLU.length).toBeGreaterThanOrEqual(80);
    expect(puts).toEqual([]);
  });

  it("does not cache when the cited source score is below the floor", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: SUPPORTED,
      sources: [{ ...WALKING, score: 0.1 }],
    });
    expect(puts).toEqual([]);
  });

  it("does not cache an answer that still contains an unknown citation", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: `${SUPPORTED} Thêm một ý. [S99]`,
      sources: [WALKING],
    });
    expect(puts).toEqual([]);
  });

  it("does not cache a 7–9 hour sleep claim attributed to Bộ Y tế", async () => {
    const { puts, CONFIG } = memoryConfig();
    const sleep = {
      ...WALKING,
      title: "Sức khỏe tinh thần người lớn tuổi — Tổ chức Y tế Thế giới",
      issuer: "Bộ Y tế Việt Nam",
      snippet:
        "Bộ Y tế nhấn mạnh người cao tuổi nên khám sức khỏe định kỳ, có sổ theo dõi bệnh và dùng thuốc đúng chỉ định bác sĩ.",
    };
    const claim =
      "Bộ Y tế khuyên người lớn ngủ từ 7 đến 9 giờ mỗi đêm để giữ sức khỏe tinh thần. [S1]";
    expect(answerAttributionsMatchSources(claim, [sleep])).toBe(false);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: claim,
      sources: [sleep],
    });
    expect(puts).toEqual([]);
  });

  it("caches an attribution that quotes the organization in the source", async () => {
    const { puts, CONFIG } = memoryConfig();
    const source: CachedSource = {
      ...WALKING,
      title: "Sức khỏe tinh thần người lớn tuổi — Tổ chức Y tế Thế giới",
      issuer: "Tổ chức Y tế Thế giới (WHO)",
      snippet:
        "Tổ chức Y tế Thế giới cho biết giấc ngủ, bệnh lâu ngày và sự quan tâm của người thân đều ảnh hưởng tinh thần người lớn tuổi.",
      score: 0.9,
    };
    const claim =
      "Tổ chức Y tế Thế giới cho biết giấc ngủ, bệnh lâu ngày và sự quan tâm của người thân đều ảnh hưởng tinh thần người lớn tuổi. [S1]";
    expect(answerAttributionsMatchSources(claim, [source])).toBe(true);
    await writeAnswerCache(
      { CONFIG } as unknown as Env,
      "Mất ngủ kéo dài ảnh hưởng tinh thần người lớn tuổi ra sao?",
      {
        classification: "health_education",
        answer: claim,
        sources: [source],
      },
    );
    expect(puts).toHaveLength(1);
  });

  it("still stores a curated bank answer that paraphrases its source", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: FLU,
      sources: [WALKING],
      mode: "answer_bank",
    });
    expect(puts).toHaveLength(1);
  });
});
