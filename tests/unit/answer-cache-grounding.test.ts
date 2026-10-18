import { describe, expect, it } from "vitest";
import { SYMPTOM_SAFETY_LINE } from "../../shared/rules/safety";
import {
  answerAttributionsMatchSources,
  answerHasModelEmergency,
  answerPostponesCare,
  CACHE_TTL_SECONDS,
  groundedSentence,
  isAffirmativeSafetyTemplate,
  isCitationOnly,
  postponesSeekingCare,
  readAnswerCache,
  sentenceDropReason,
  sentenceIsSupported,
  supportedAnswerText,
  writeAnswerCache,
  type CachedSource,
} from "../../worker/ai/answer-cache";
import { clipSnippet } from "../../worker/ai/local-retrieve";
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
  const puts: { key: string; value: string; ttl?: number }[] = [];
  const CONFIG = {
    async get() {
      return null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      puts.push({ key, value, ttl: options?.expirationTtl });
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
    expect(puts[0]?.ttl).toBe(CACHE_TTL_SECONDS);
    expect(CACHE_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });

  it("stores a curated bank answer only when the text is grounded", async () => {
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: SUPPORTED,
      sources: [WALKING],
      mode: "answer_bank",
    });
    expect(puts).toHaveLength(1);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: FLU,
      sources: [WALKING],
      mode: "answer_bank",
    });
    expect(puts).toHaveLength(1);
  });

  it("does not let gọi 115 carry an uncited study, URL, or medication change", () => {
    const invented =
      "Theo một nghiên cứu Lancet (https://example.com/study), hãy ngừng thuốc tiểu đường, gọi 115. [S1]";
    expect(sentenceIsSupported(invented, [WALKING], QUESTION)).toBe(false);
    expect(groundedSentence(invented, [WALKING], QUESTION)).toBe("");
    expect(sentenceDropReason(invented, [WALKING], QUESTION)).toBe("model_115");
    expect(sentenceIsSupported(SYMPTOM_SAFETY_LINE, [WALKING], QUESTION)).toBe(true);
    expect(sentenceIsSupported("Hãy gọi ngay 115.", [WALKING], QUESTION)).toBe(true);
    expect(sentenceIsSupported("Hãy gọi 115 ngay.", [WALKING], QUESTION)).toBe(true);
    expect(sentenceIsSupported("[S1]", [WALKING], QUESTION)).toBe(false);
    expect(sentenceIsSupported("Gọi 115 khi bị sốt cao.", [WALKING], QUESTION)).toBe(
      false,
    );
    expect(groundedSentence("Gọi 115 khi bị sốt cao.", [WALKING], QUESTION)).toBe("");
    expect(groundedSentence(SYMPTOM_SAFETY_LINE, [WALKING], QUESTION)).toBe("");
  });

  it("drops either/or, hedges, and negators without folding hay into hãy", () => {
    const rejected = [
      "Gọi 115 hay đến bệnh viện.",
      "Goi 115 hay den benh vien.",
      "Hãy gọi 115 hay đến nhà.",
      "Hay gọi 115 ngay.",
      "Hay goi 115 ngay.",
      "Có thể gọi 115 hoặc nhờ người nhà.",
      "Co the goi 115 hoac nho nguoi nha.",
      "Gọi 115 ngay nếu bạn muốn, hoặc đến nhà.",
      "Bạn không cần gọi 115.",
      "Ban khong can goi 115.",
      "Đừng gọi 115.",
      "Dung goi 115.",
    ];
    for (const sentence of rejected) {
      expect(isAffirmativeSafetyTemplate(sentence, [WALKING]), sentence).toBe(false);
      expect(sentenceIsSupported(sentence, [WALKING], QUESTION), sentence).toBe(false);
      expect(groundedSentence(sentence, [WALKING], QUESTION), sentence).toBe("");
      expect(sentenceDropReason(sentence, [WALKING], QUESTION), sentence).toBe(
        "model_115",
      );
    }
    expect(isAffirmativeSafetyTemplate("Hãy gọi 115 ngay.", [WALKING])).toBe(true);
    expect(isAffirmativeSafetyTemplate("Goi 115 ngay.", [WALKING])).toBe(true);
    expect(isAffirmativeSafetyTemplate(SYMPTOM_SAFETY_LINE, [WALKING])).toBe(true);
    const backed = "Gọi 115 ngay nếu người 61 tuổi đi bộ buổi sáng.";
    expect(isAffirmativeSafetyTemplate(backed, [WALKING])).toBe(true);
    expect(sentenceIsSupported(backed, [WALKING], QUESTION)).toBe(true);
    expect(groundedSentence(backed, [WALKING], QUESTION)).toBe("");
    expect(answerHasModelEmergency(`Đi bộ buổi sáng. ${backed}`)).toBe(true);
    expect(answerHasModelEmergency(`Đi bộ buổi sáng.\n\n${SYMPTOM_SAFETY_LINE}`)).toBe(
      false,
    );
  });

  it("rejects a negated or hedged 115 line, with and without accents", async () => {
    const negated = [
      "Bạn không gọi 115.",
      "Ban khong goi 115.",
      "Bạn chẳng gọi 115.",
      "Ban chang goi 115.",
      "Bạn chưa gọi 115.",
      "Ban chua goi 115.",
      "Đừng gọi 115.",
      "Dung goi 115.",
      "Khỏi gọi 115.",
      "Khoi goi 115.",
      "Bạn không cần gọi ngay 115.",
      "Ban khong can goi ngay 115.",
      "Bạn không nên gọi 115.",
      "Ban khong nen goi 115.",
      "There is no need to call 115.",
      "Don't call 115.",
      "Dont goi 115.",
      "It is not necessary to gọi 115.",
      "Gọi 115 unless the pain has stopped.",
    ];
    for (const sentence of negated) {
      expect(sentenceIsSupported(sentence, [WALKING], QUESTION), sentence).toBe(false);
      expect(groundedSentence(sentence, [WALKING], QUESTION), sentence).toBe("");
    }

    const stored = "Bạn không cần gọi ngay 115. ".repeat(6);
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: stored,
      sources: [WALKING],
    });
    expect(puts).toEqual([]);
    const replay = await readAnswerCache(
      {
        CONFIG: {
          async get() {
            return JSON.stringify({
              classification: "health_education",
              answer: stored,
              sources: [WALKING],
              mode: "kv_cache",
              cachedAt: "2026-10-18T00:00:00.000Z",
            });
          },
          async put() {
            return undefined;
          },
        },
      } as unknown as Env,
      QUESTION,
    );
    expect(replay).toBeNull();
  });

  it("treats a source header as empty even when the snippet says Nguồn", async () => {
    const header = "Nguồn: [S1] ".repeat(8);
    const source = {
      ...WALKING,
      snippet: "Nguồn tra cứu đi bộ buổi sáng cho người lớn tuổi theo hướng dẫn.",
    };
    expect(isCitationOnly(header)).toBe(true);
    expect(sentenceIsSupported(header, [source], QUESTION)).toBe(false);
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: header,
      sources: [source],
    });
    expect(puts).toEqual([]);
    const replay = await readAnswerCache(
      {
        CONFIG: {
          async get() {
            return JSON.stringify({
              classification: "health_education",
              answer: header,
              sources: [source],
              mode: "kv_cache",
              cachedAt: "2026-10-18T00:00:00.000Z",
            });
          },
          async put() {
            return undefined;
          },
        },
      } as unknown as Env,
      QUESTION,
    );
    expect(replay).toBeNull();
  });

  it("does not cache when any cited source is off topic", async () => {
    const { puts, CONFIG } = memoryConfig();
    const offTopic: CachedSource = {
      ...WALKING,
      key: "S2",
      title: "Thủ tục hưởng lương hưu",
      snippet: "Hồ sơ hưởng lương hưu nộp tại cơ quan bảo hiểm xã hội.",
      url: "https://baohiemxahoi.gov.vn/Pages/huong-dan-huong-luong-huu.aspx",
      score: 0.9,
    };
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: `${SUPPORTED} Thủ tục lương hưu nộp tại cơ quan bảo hiểm. [S2]`,
      sources: [WALKING, offTopic],
    });
    expect(puts).toEqual([]);
  });

  it("does not cache a grounded answer that also carries a model 115 sentence", async () => {
    const { puts, CONFIG } = memoryConfig();
    const answer = `${SUPPORTED} Hãy gọi 115 ngay.`;
    expect(answer.length).toBeGreaterThan(80);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer,
      sources: [WALKING],
    });
    expect(puts).toEqual([]);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: `${SUPPORTED}\n\n${SYMPTOM_SAFETY_LINE}`,
      sources: [WALKING],
    });
    expect(puts).toHaveLength(1);
  });

  it("keeps a paraphrase of the snippet and records why other sentences drop", () => {
    const paraphrase =
      "Người 61 tuổi giữ sức khỏe khi duy trì nhịp đi bộ vào buổi sáng, theo hướng dẫn. [S1]";
    expect(sentenceDropReason(paraphrase, [WALKING], QUESTION)).toBeNull();
    expect(sentenceIsSupported(paraphrase, [WALKING], QUESTION)).toBe(true);
    const loose =
      "Người 61 tuổi nên giữ sức bằng nhịp đi bộ buổi sáng theo hướng dẫn.";
    expect(groundedSentence(loose, [WALKING], QUESTION)).toContain("[S1]");
    const invented = "Kháng sinh chữa khỏi bệnh cúm sau ba ngày. [S1]";
    expect(sentenceDropReason(invented, [WALKING], QUESTION)).toBe("low_overlap");
    const generated = [
      paraphrase,
      loose,
      "Duy trì nhịp đi bộ buổi sáng giúp người 61 tuổi giữ sức khỏe. [S1]",
      "Theo hướng dẫn, người 61 tuổi nên đi bộ buổi sáng để giữ sức khỏe. [S1]",
      "Nhịp đi bộ buổi sáng là cách người 61 tuổi giữ sức khỏe theo hướng dẫn. [S1]",
      invented,
      "Một nghiên cứu Lancet năm 2019 chứng minh giảm 40% nguy cơ. [S1]",
      "Uống thuốc nam mỗi sáng sẽ khỏi bệnh hoàn toàn. [S1]",
      "Bệnh viện tư nhân cam kết chữa dứt điểm. [S1]",
      "Vitamin liều cao thay cho việc đi khám. [S1]",
    ];
    const kept = generated.filter(
      (sentence) => sentenceDropReason(sentence, [WALKING], QUESTION) === null,
    );
    expect(kept.length / generated.length).toBeGreaterThanOrEqual(0.5);
  });

  it("drops a URL that was cut off and never slices one in half", () => {
    const full = `${"Đi bộ buổi sáng. ".repeat(20)} Xem https://www.who.int/news-room/fact-sheets/detail/ageing-and-health để đọc tiếp.`;
    const clipped = clipSnippet(full, 80);
    expect(clipped).not.toMatch(/https?:\/\/\S*/);
    expect(clipped.startsWith("https")).toBe(false);
    const cut = "Xem https://www.who.int/news-room/fact-she để biết thêm. [S1]";
    expect(sentenceDropReason(cut, [WALKING], QUESTION)).not.toBeNull();
    expect(groundedSentence(cut, [WALKING], QUESTION)).not.toMatch(/https?:\/\//);
    const intact =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    expect(sentenceIsSupported(intact, [WALKING], QUESTION)).toBe(true);
  });

  it("drops care avoidance in cited and uncited form and does not cache it", async () => {
    const source: CachedSource = {
      ...WALKING,
      snippet:
        "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. Nên gặp bác sĩ khi cần. Hãy đi khám nếu mệt.",
    };
    const avoided = [
      "Bạn không cần đi khám. [S1]",
      "Ban khong can di kham.",
      "Không cần gặp bác sĩ. [S1]",
      "Khong can gap bac si.",
      "Đừng đến bệnh viện.",
      "Dung den benh vien.",
      "Khỏi đi khám.",
      "Khoi di kham.",
      "Cứ ở nhà chờ là được.",
      "Cu o nha cho la duoc.",
      "No need to see a doctor. [S1]",
      "Don't go to the hospital.",
      "Just wait at home.",
      "Chưa cần kiểm tra sức khỏe.",
    ];
    for (const sentence of avoided) {
      expect(postponesSeekingCare(sentence), sentence).toBe(true);
      expect(sentenceIsSupported(sentence, [source], QUESTION), sentence).toBe(false);
      expect(groundedSentence(sentence, [source], QUESTION), sentence).toBe("");
      expect(sentenceDropReason(sentence, [source], QUESTION), sentence).toBe(
        "care_avoidance",
      );
    }
    const positive = [
      "Hãy đi khám nếu mệt. [S1]",
      "Nên gặp bác sĩ khi cần để giữ sức khỏe theo hướng dẫn. [S1]",
      "Hay di kham neu met.",
    ];
    expect(postponesSeekingCare(positive[0]!)).toBe(false);
    expect(postponesSeekingCare(positive[1]!)).toBe(false);
    expect(sentenceIsSupported(positive[0]!, [source], QUESTION)).toBe(true);
    expect(sentenceIsSupported(positive[1]!, [source], QUESTION)).toBe(true);
    expect(postponesSeekingCare("Sử dụng thuốc rồi hãy đi khám.")).toBe(false);

    const { puts, CONFIG } = memoryConfig();
    const grounded =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: `${grounded} Bạn không cần đi khám. [S1]`,
      sources: [source],
    });
    expect(puts).toEqual([]);
    expect(answerPostponesCare(`${grounded} Ban khong can gap bac si.`)).toBe(true);
    const kept =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn và nên gặp bác sĩ khi cần. [S1]";
    expect(sentenceIsSupported(kept, [source], QUESTION)).toBe(true);
    expect(answerPostponesCare(kept)).toBe(false);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: kept,
      sources: [source],
    });
    expect(puts).toHaveLength(1);
  });

  it("drops meta, echoes, headers, and issuer tags before attaching a chip", () => {
    expect(groundedSentence("Dưới đây là phần trả lời về đi bộ.", [WALKING], QUESTION)).toBe(
      "",
    );
    expect(
      sentenceDropReason("Tôi sẽ trả lời câu hỏi này.", [WALKING], QUESTION),
    ).toBe("meta");
    expect(sentenceDropReason(`${QUESTION} [S1]`, [WALKING], QUESTION)).toBe("echo");
    expect(groundedSentence("Nguồn: đi bộ buổi sáng [S1]", [WALKING], QUESTION)).toBe("");
    expect(groundedSentence("Bộ Y tế.", [WALKING], QUESTION)).toBe("");
    expect(groundedSentence("WHO [S1]", [WALKING], QUESTION)).toBe("");
    expect(
      groundedSentence(
        "**Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng. [S1]",
        [WALKING],
        QUESTION,
      ),
    ).toBe("");
    const closed =
      "**Người 61 tuổi** nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    expect(sentenceDropReason(closed, [WALKING], QUESTION)).toBeNull();
  });

  it("keeps a factual 115, a full host, and the sentence after a URL", () => {
    const source: CachedSource = {
      ...WALKING,
      snippet:
        "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. Tài liệu theo dõi 115 trường hợp.",
    };
    const factual =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn, với 115 trường hợp được theo dõi. [S1]";
    expect(sentenceDropReason(factual, [source], QUESTION)).toBeNull();
    expect(sentenceIsSupported(factual, [source], QUESTION)).toBe(true);
    expect(groundedSentence("Gọi 115 khi mệt.", [source], QUESTION)).toBe("");

    const host =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn (https://www.who.int). [S1]";
    expect(groundedSentence(host, [WALKING], QUESTION)).toContain("https://www.who.int");
    expect(
      groundedSentence("Xem thêm tại https://www.who.int/news-room/fact-she. [S1]", [
        WALKING,
      ], QUESTION),
    ).toBe("");
    const boundary = supportedAnswerText(
      "Xem https://www.who.int/news-room/fact-sheets/detail/ageing-and-health. Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]",
      [WALKING],
      QUESTION,
    );
    expect(boundary).toContain("duy trì nhịp đi bộ");
    expect(boundary.match(/\[S1\]/g)?.length).toBe(1);
    const doubled = groundedSentence(
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1] [S1]",
      [WALKING],
      QUESTION,
    );
    expect(doubled.match(/\[S1\]/g)?.length).toBe(1);
    expect(
      supportedAnswerText(
        "TP. Hồ Chí Minh khuyên người 61 tuổi duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]",
        [WALKING],
        QUESTION,
      ),
    ).toContain("TP.");
  });
});
