import { describe, expect, it } from "vitest";
import { SYMPTOM_SAFETY_LINE } from "../../shared/rules/safety";
import {
  answerAttributionsMatchSources,
  answerEchoesQuestion,
  answerHasModelEmergency,
  answerFailsCache,
  answerPostponesCare,
  consumeModelLine,
  isExtractiveCareSentence,
  CACHE_TTL_SECONDS,
  CARE_TERMS,
  LIMITER_TOKENS,
  MODAL_TOKENS,
  NEGATOR_TOKENS,
  TIME_TOKENS,
  groundedSentence,
  isAffirmativeSafetyTemplate,
  isCitationOnly,
  postponesSeekingCare,
  cacheKeyForQuestion,
  readAnswerCache,
  sentenceDropReason,
  sentenceIsSupported,
  supportedAnswerText,
  writeAnswerCache,
  type CachedSource,
} from "../../worker/ai/answer-cache";
import { clipSnippet, completeHttpUrl, isCompleteHttpUrl } from "../../worker/ai/local-retrieve";
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
    expect(sentenceDropReason(invented, [WALKING], QUESTION)).toBe("care_avoidance");
    const generated = [
      paraphrase,
      loose,
      "Duy trì nhịp đi bộ buổi sáng giúp người 61 tuổi giữ sức khỏe theo hướng dẫn. [S1]",
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
      "Cứ ở nhà, không cần đi khám.",
      "Cu o nha, khong can di kham.",
      "No need to see a doctor. [S1]",
      "Don't go to the hospital.",
      "Just wait at home instead of a doctor.",
      "Chưa cần kiểm tra sức khỏe.",
      "Không cần gọi cấp cứu.",
      "Khong can goi cap cuu.",
      "Không cần gọi xe cấp cứu.",
      "Khong can xe cap cuu.",
      "No need to take to emergency.",
      "Tự theo dõi không cần khám.",
      "Tu theo doi khong can kham.",
      "Self-monitor without an exam.",
      "Đợi vài ngày rồi khám.",
      "Doi vai ngay roi kham.",
      "Wait a few days before an exam.",
      "Không cần trợ giúp y tế.",
      "Khong can tro giup y te.",
      "Medical help is unnecessary.",
    ];
    for (const sentence of avoided) {
      expect(postponesSeekingCare(sentence), sentence).toBe(true);
      expect(sentenceIsSupported(sentence, [source], QUESTION), sentence).toBe(false);
      expect(groundedSentence(sentence, [source], QUESTION), sentence).toBe("");
      expect(sentenceDropReason(sentence, [source], QUESTION), sentence).toBe(
        "care_avoidance",
      );
    }
    const modalCare = [
      "Nên gặp bác sĩ khi cần để giữ sức khỏe theo hướng dẫn. [S1]",
      "Hay di kham neu met.",
    ];
    for (const sentence of modalCare) {
      expect(postponesSeekingCare(sentence, [source]), sentence).toBe(true);
      expect(answerFailsCache(sentence, [source]), sentence).toBe(true);
      expect(groundedSentence(sentence, [source], QUESTION), sentence).toBe("");
    }
    const copiedCare = "Hãy đi khám nếu mệt. [S1]";
    expect(isExtractiveCareSentence(copiedCare, [source])).toBe(true);
    expect(postponesSeekingCare(copiedCare, [source])).toBe(false);
    expect(groundedSentence(copiedCare, [source], QUESTION)).toContain("đi khám");
    for (const sentence of ["Không cần gọi 115.", "Khong can goi 115."]) {
      expect(postponesSeekingCare(sentence), sentence).toBe(true);
      expect(sentenceDropReason(sentence, [source], QUESTION), sentence).toBe("model_115");
      expect(groundedSentence(sentence, [source], QUESTION), sentence).toBe("");
    }
    expect(postponesSeekingCare("Sử dụng thuốc rồi hãy đi khám.")).toBe(true);
    expect(answerFailsCache("Su dung thuoc roi hay di kham.")).toBe(true);
    expect(postponesSeekingCare("Không cần lo, hãy gặp bác sĩ khi cần.")).toBe(true);
    const downgrades = [
      "Bạn có thể skip việc đi khám.",
      "No need for medical help.",
      "It is not necessary to go to the hospital.",
      "Wait until tomorrow to see a doctor.",
      "See a doctor later.",
      "Ngày mai hãy đi khám.",
      "Ngay mai hay di kham.",
      "Để sau rồi gặp bác sĩ.",
      "De sau roi gap bac si.",
      "Hãy đi khám sau.",
      "Just rest, a doctor is not necessary.",
      "Cứ nghỉ, không cần đi bệnh viện.",
      "Bỏ qua kiểm tra sức khỏe.",
      "Bo qua kiem tra suc khoe.",
    ];
    for (const sentence of downgrades) {
      expect(postponesSeekingCare(sentence), sentence).toBe(true);
      expect(sentenceDropReason(sentence, [source], QUESTION), sentence).toBe(
        "care_avoidance",
      );
    }
    const urgency = [
      "You should not wait but call a doctor.",
      "Don't hesitate to call a doctor.",
      "Do not delay calling a doctor.",
      "Do not stop medicines without a doctor.",
      "Do not skip getting checked.",
      "You should not postpone the exam.",
      "Không bỏ qua việc đi khám.",
      "Đừng chờ, hãy đến bệnh viện.",
    ];
    for (const sentence of urgency) {
      expect(postponesSeekingCare(sentence, [source]), sentence).toBe(true);
      expect(answerFailsCache(sentence, [source]), sentence).toBe(true);
      expect(groundedSentence(sentence, [source], QUESTION), sentence).toBe("");
      expect(supportedAnswerText(sentence, [source], QUESTION), sentence).toBe("");
    }

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
    expect(answerPostponesCare(`${grounded} Khong can goi cap cuu.`)).toBe(true);
    expect(answerPostponesCare(`${grounded} Doi vai ngay roi kham.`)).toBe(true);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: `${grounded} Không cần trợ giúp y tế.`,
      sources: [source],
    });
    expect(puts).toEqual([]);
    const kept =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    expect(sentenceIsSupported(kept, [source], QUESTION)).toBe(true);
    expect(answerFailsCache(kept)).toBe(false);
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: kept,
      sources: [source],
    });
    expect(puts).toHaveLength(1);
    const withDoctor =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn và nên gặp bác sĩ khi cần. [S1]";
    expect(answerFailsCache(withDoctor)).toBe(true);
    expect(groundedSentence(withDoctor, [source], QUESTION)).toBe("");
  });

  it("drops meta, echoes, headers, and issuer tags before attaching a chip", () => {
    expect(groundedSentence("Dưới đây là phần trả lời về đi bộ.", [WALKING], QUESTION)).toBe(
      "",
    );
    expect(
      sentenceDropReason("Tôi sẽ trả lời câu hỏi này.", [WALKING], QUESTION),
    ).toBe("meta");
    expect(sentenceDropReason(`${QUESTION} [S1]`, [WALKING], QUESTION)).toBe("echo");
    expect(answerEchoesQuestion(`${QUESTION} [S1]`, QUESTION, [WALKING])).toBe(true);
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
    const unclosedClaim =
      "**Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    const opened = groundedSentence(unclosedClaim, [WALKING], QUESTION);
    expect(opened).toContain("hướng dẫn");
    expect(opened).not.toContain("**");
    expect(sentenceDropReason(unclosedClaim, [WALKING], QUESTION)).toBeNull();
    const leading =
      "**Bộ Y tế** Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    expect(groundedSentence(leading, [WALKING], QUESTION)).toBe("");
    expect(groundedSentence("**Bộ Y tế** [S1]", [WALKING], QUESTION)).toBe("");
    expect(sentenceDropReason("Bạn có nên đi bộ buổi sáng không? [S1]", [WALKING], QUESTION)).toBe(
      "rhetorical",
    );
    expect(groundedSentence("WHO [S1]", [WALKING], QUESTION)).toBe("");
    expect(
      groundedSentence(
        "Người 61 tuổi nên chạy marathon mỗi tuần để giảm cân theo hướng dẫn. [S1]",
        [WALKING],
        QUESTION,
      ),
    ).toBe("");
    expect(sentenceDropReason("Đi bộ sáng. [S1]", [WALKING], QUESTION)).toBe("echo");
  });

  it("does not cache a cited echo of the question", async () => {
    const { puts, CONFIG } = memoryConfig();
    const echo = `${QUESTION}. [S1] ${SUPPORTED}`;
    expect(answerEchoesQuestion(echo, QUESTION, [WALKING])).toBe(true);
    expect(sentenceDropReason(`${QUESTION} [S1]`, [WALKING], QUESTION)).toBe("echo");
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: echo,
      sources: [WALKING],
    });
    expect(puts).toEqual([]);
  });

  it("keeps a factual 115, a full host, and the sentence after a URL", () => {
    const source: CachedSource = {
      ...WALKING,
      snippet:
        "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. Tài liệu theo dõi 115 trường hợp.",
    };
    const factual = "Tài liệu theo dõi 115 trường hợp. [S1]";
    expect(sentenceDropReason(factual, [source], QUESTION)).toBeNull();
    expect(sentenceIsSupported(factual, [source], QUESTION)).toBe(true);
    const paraphrased115 =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn, với 115 trường hợp được theo dõi. [S1]";
    expect(sentenceDropReason(paraphrased115, [source], QUESTION)).toBe("care_avoidance");
    expect(groundedSentence("Gọi 115 khi mệt.", [source], QUESTION)).toBe("");

    const host =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn (https://www.who.int). [S1]";
    expect(groundedSentence(host, [WALKING], QUESTION)).toContain("https://www.who.int");
    expect(
      groundedSentence("Xem thêm tại https://www.who.int/news-room/fact-she. [S1]", [
        WALKING,
      ], QUESTION),
    ).toBe("");
    expect(isCompleteHttpUrl("https://www.who.int/news-room/fact-sheets/detail/ageing-")).toBe(
      false,
    );
    expect(isCompleteHttpUrl("https://www.who.int/news-room/fact-sheets/detail/ageing.")).toBe(
      false,
    );
    expect(
      isCompleteHttpUrl(
        "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
      ),
    ).toBe(true);
    expect(
      groundedSentence(
        "… xem thêm tại https://www.who.int/news-room/fact-sheets/detail/ageing- [S1]",
        [WALKING],
        QUESTION,
      ),
    ).toBe("");
    expect(
      groundedSentence(
        "… xem thêm tại https://www.who.int/news-room/fact-sheets/detail/ageing. [S1]",
        [WALKING],
        QUESTION,
      ),
    ).toBe("");
    const finished =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn (https://www.who.int/news-room/fact-sheets/detail/ageing-and-health). [S1]";
    expect(groundedSentence(finished, [WALKING], QUESTION)).toContain(
      "https://www.who.int/news-room/fact-sheets/detail/ageing-and-health",
    );
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

  it("fails cache for every care term crossed with every operator", () => {
    const operators = [...NEGATOR_TOKENS, ...MODAL_TOKENS, ...TIME_TOKENS, ...LIMITER_TOKENS];
    for (const care of CARE_TERMS) {
      for (const operator of operators) {
        const sentence = `${operator} ${care}.`;
        expect(answerFailsCache(sentence), sentence).toBe(true);
        expect(answerPostponesCare(sentence), sentence).toBe(true);
      }
    }
  });

  it("drops the r9 downgrade table on the stream and non-stream paths and never caches it", async () => {
    const cases = [
      { id: "X01", text: "Bạn không cần đi khám." },
      { id: "X11", text: "Không cần gặp bác sĩ." },
      { id: "X13", text: "Ngày mai hãy đi khám." },
      { id: "X04", text: "Khỏi gọi cấp cứu." },
      { id: "X05", text: "Tự theo dõi, không cần kiểm tra sức khỏe." },
      { id: "Z01", text: "Không nên đi khám." },
      { id: "Z02", text: "Không nên gặp bác sĩ." },
      { id: "Z12", text: "Khong nen di kham." },
      { id: "Z04", text: "Đi khám chưa cần." },
      { id: "Z10", text: "Hạn chế đi bệnh viện." },
      { id: "EN-should-not", text: "You should not see a doctor." },
      { id: "EN-shouldnt", text: "You shouldn't go to the hospital." },
      { id: "D01", text: "Khám mai." },
      { id: "D05", text: "Đợi vài ngày nữa rồi đi khám." },
      { id: "EN-next-week", text: "See a doctor next week." },
      { id: "EN-put-off", text: "Put off the exam." },
    ];
    const { puts, CONFIG } = memoryConfig();
    const pad =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    for (const row of cases) {
      const streamed = groundedSentence(row.text, [WALKING], QUESTION);
      const finished = supportedAnswerText(row.text, [WALKING], QUESTION);
      expect(streamed, row.id).toBe("");
      expect(finished, row.id).toBe(streamed);
      expect(answerFailsCache(`${pad} ${row.text}`), row.id).toBe(true);
      await writeAnswerCache({ CONFIG } as unknown as Env, `${QUESTION} ${row.id}`, {
        classification: "health_education",
        answer: `${pad} ${row.text}`,
        sources: [WALKING],
      });
    }
    expect(puts).toEqual([]);
  });

  it("refuses a stale key whose answer contains a care term", async () => {
    const store = new Map<string, string>();
    const CONFIG = {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
    };
    const stale = cacheKeyForQuestion(QUESTION).replace("ans_cache:v9:", "ans_cache:v8:");
    store.set(
      stale,
      JSON.stringify({
        classification: "health_education",
        answer:
          "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. Không cần đi khám. [S1]",
        sources: [WALKING],
        mode: "kv_cache",
      }),
    );
    expect(await readAnswerCache({ CONFIG } as unknown as Env, QUESTION)).toBeNull();
    const current = cacheKeyForQuestion(QUESTION);
    store.set(
      current,
      JSON.stringify({
        classification: "health_education",
        answer:
          "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn và nên gặp bác sĩ. [S1]",
        sources: [WALKING],
        mode: "kv_cache",
      }),
    );
    expect(await readAnswerCache({ CONFIG } as unknown as Env, QUESTION)).toBeNull();
  });

  it("gives chips only to claims, on the stream and the finished answer", () => {
    const claim =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    const streamLike = (sample: string) => {
      const state = { label: null as string | null };
      const parts: string[] = [];
      for (const line of sample.split(/\n+/)) {
        const consumed = consumeModelLine(line, state);
        state.label = consumed.label;
        if (!consumed.emit) continue;
        const grounded = groundedSentence(consumed.emit, [WALKING], QUESTION);
        if (grounded) parts.push(grounded);
      }
      return parts.join(" ");
    };
    const peeled = [`Tóm tắt:\n${claim}`, `**Summary:** ${claim}`, `Answer: ${claim}`];
    for (const sample of peeled) {
      const finished = supportedAnswerText(sample, [WALKING], QUESTION);
      expect(finished, sample).toBe(streamLike(sample));
      expect(finished, sample).toContain("hướng dẫn");
      expect(finished, sample).not.toMatch(/tóm tắt|summary|answer/i);
      expect(finished, sample).not.toMatch(/:\s*\[S1\]/);
      expect(answerFailsCache(finished, [WALKING]), sample).toBe(false);
    }
    const bound = streamLike(`**X**:\n${claim}`);
    expect(bound).toBe(supportedAnswerText(`**X**:\n${claim}`, [WALKING], QUESTION));
    expect(bound).toContain("X:");
    expect(bound).toContain("hướng dẫn");
    expect(supportedAnswerText(`Cảm ơn bạn đã hỏi. [S1]\n${claim}`, [WALKING], QUESTION)).toContain(
      "hướng dẫn",
    );
    expect(supportedAnswerText(`${claim} — WHO [S1]`, [WALKING], QUESTION)).not.toMatch(/WHO/);
    expect(groundedSentence("Lời khuyên:", [WALKING], QUESTION)).toBe("");
    expect(groundedSentence("Tổ chức Y tế Thế giới [S1]", [WALKING], QUESTION)).toBe("");
    expect(groundedSentence("Cảm ơn bạn. [S1]", [WALKING], QUESTION)).toBe("");
    const stray = groundedSentence(
      "[Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]",
      [WALKING],
      QUESTION,
    );
    expect(stray.startsWith("[")).toBe(false);
    expect(stray).toContain("hướng dẫn");
    expect(groundedSentence("… tại [S1].", [WALKING], QUESTION)).toBe("");
  });

  it("strips a URL whose host is not the cited host and keeps a finished who.int link", () => {
    const bhxh: CachedSource = {
      ...WALKING,
      url: "https://baohiemxahoi.gov.vn/Pages/huong-dan.aspx",
    };
    const moh: CachedSource = {
      ...WALKING,
      url: "https://moh.gov.vn/huong-dan",
    };
    expect(
      groundedSentence("Xem thêm tại https://baohiemxahoi.gov/Pages. [S1]", [bhxh], QUESTION),
    ).toBe("");
    expect(groundedSentence("Xem thêm tại https://moh.gov/huong. [S1]", [moh], QUESTION)).toBe("");
    const kept = groundedSentence(
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn (https://www.who.int.). [S1]",
      [WALKING],
      QUESTION,
    );
    expect(kept).toContain("https://www.who.int");
    expect(completeHttpUrl("https://www.who.int.")).toBe("https://www.who.int");
    expect(answerFailsCache(kept)).toBe(false);
  });

  it("shows and caches a care sentence only when it copies one cited sentence", async () => {
    const ambulance = "Call an ambulance when unable to stand.";
    const hospital = "Đến bệnh viện khi người bệnh không tự đứng được.";
    const source: CachedSource = {
      ...WALKING,
      snippet: `${WALKING.snippet} ${ambulance} ${hospital}`,
    };
    const k18 = `${ambulance} [S1]`;
    const k13 = `${hospital} [S1]`;
    expect(isExtractiveCareSentence(k18, [source]), "K18").toBe(true);
    expect(isExtractiveCareSentence(k13, [source]), "K13").toBe(true);
    expect(groundedSentence(k18, [source], QUESTION), "K18").toContain("ambulance");
    expect(groundedSentence(k13, [source], QUESTION), "K13").toContain("bệnh viện");
    expect(supportedAnswerText(k18, [source], QUESTION), "K18").toBe(
      groundedSentence(k18, [source], QUESTION),
    );
    const paraphrases = [
      { id: "K01", text: "You should see a doctor." },
      { id: "K02", text: "Hãy đi khám." },
      { id: "K03", text: "Nên gặp bác sĩ." },
      { id: "K04", text: "See a physician if you feel worse." },
    ];
    for (const row of paraphrases) {
      expect(isExtractiveCareSentence(row.text, [source]), row.id).toBe(false);
      expect(groundedSentence(row.text, [source], QUESTION), row.id).toBe("");
      expect(supportedAnswerText(`${row.text} [S1]`, [source], QUESTION), row.id).toBe("");
      expect(answerFailsCache(`${k18} ${row.text}`, [source]), row.id).toBe(true);
    }
    const cachedCare = `${k13}\n${k18}\n${k13}`;
    expect(answerFailsCache(cachedCare, [source])).toBe(false);
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, QUESTION, {
      classification: "health_education",
      answer: cachedCare,
      sources: [source],
    });
    expect(puts).toHaveLength(1);
    await writeAnswerCache({ CONFIG } as unknown as Env, `${QUESTION} k01`, {
      classification: "health_education",
      answer: `${cachedCare}\n${paraphrases[0]?.text}`,
      sources: [source],
    });
    expect(puts).toHaveLength(1);
  });

  it("drops downgrades, english negators, and positive-urgency wording that is not in the source", () => {
    const source: CachedSource = {
      ...WALKING,
      snippet: "Call an ambulance when unable to stand.",
    };
    const rows = [
      { id: "X11", text: "Không cần gặp bác sĩ." },
      { id: "N15", text: "Bạn không phải đến bệnh viện." },
      { id: "N16", text: "Không cần dùng thuốc." },
      { id: "N17", text: "Chưa cần đi cấp cứu." },
      { id: "D05", text: "Đợi vài ngày nữa rồi đi khám." },
      { id: "EN-isnt", text: "It isn't necessary to see a doctor." },
      { id: "EN-doesnt", text: "This doesn't need a hospital." },
      { id: "EN-neednt", text: "You needn't go to the clinic." },
      { id: "PU1", text: "You should not wait but call a doctor." },
      { id: "PU3", text: "Do not delay calling a doctor." },
      { id: "PU6", text: "Do not stop medicines without a doctor." },
      { id: "PU7", text: "Do not skip getting checked." },
      { id: "PU8", text: "You should not postpone the exam." },
      { id: "PU9", text: "Đừng chờ, hãy đến bệnh viện." },
      { id: "GB1", text: "You should see a doctor about this." },
      { id: "GB2", text: "Hãy đến phòng khám khi cần." },
      { id: "GB3", text: "A clinic visit is a good idea." },
    ];
    for (const row of rows) {
      expect(sentenceDropReason(`${row.text} [S1]`, [source], QUESTION), row.id).toBe(
        "care_avoidance",
      );
      expect(groundedSentence(row.text, [source], QUESTION), row.id).toBe("");
      expect(supportedAnswerText(row.text, [source], QUESTION), row.id).toBe(
        groundedSentence(row.text, [source], QUESTION),
      );
      expect(answerFailsCache(row.text, [source]), row.id).toBe(true);
    }
    expect(groundedSentence("Call an ambulance when unable to stand. [S1]", [source], QUESTION)).toContain(
      "ambulance",
    );
  });

  it("keeps a scope label on the sentence and on each following list item", () => {
    const kidney = "Patients with kidney disease: do not start this medicine at home.";
    const avoid = "Things to avoid: call an ambulance when unable to stand.";
    const source: CachedSource = {
      ...WALKING,
      snippet: `${kidney} ${avoid}`,
    };
    const hc2 = groundedSentence(kidney, [source], QUESTION);
    expect(hc2, "HC2").toContain("kidney");
    expect(hc2, "HC2").toContain("medicine");
    const hc5 = supportedAnswerText(
      "Things to avoid:\n- call an ambulance when unable to stand.",
      [source],
      QUESTION,
    );
    expect(hc5, "HC5").toContain("Things to avoid");
    expect(hc5, "HC5").toContain("ambulance");
    const droppedScope = [
      { id: "HC3", text: "Không nên: tự ý đổi thuốc." },
      {
        id: "HC6",
        text: "Sai lầm:\n- Ngừng thuốc khi đã đỡ.",
      },
      { id: "HC7", text: "Avoid:\n- the clinic visit tomorrow." },
      { id: "HC8", text: "Common mistake:\n- self-adjust the antibiotic." },
      { id: "HC9", text: "Do not:\n- go to the hospital later." },
    ];
    for (const row of droppedScope) {
      expect(supportedAnswerText(row.text, [source], QUESTION), row.id).toBe("");
      expect(answerFailsCache(row.text, [source]), row.id).toBe(true);
    }
    const scopedWalk =
      "patients with kidney disease:\nNgười 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn.";
    const scopedShown = supportedAnswerText(scopedWalk, [WALKING], QUESTION);
    expect(scopedShown.startsWith("Người 61")).toBe(false);
    if (scopedShown.includes("hướng dẫn")) expect(scopedShown).toContain("kidney");
  });

  it("removes a trailing issuer line and an ordinal lead-in", async () => {
    const claim =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn. [S1]";
    expect(supportedAnswerText(`${claim}\n— WHO [S1]`, [WALKING], QUESTION), "T01").toBe(claim);
    expect(supportedAnswerText(`${claim}\n— Bộ Y tế`, [WALKING], QUESTION), "T01").toBe(claim);
    expect(supportedAnswerText(`First, ${claim}`, [WALKING], QUESTION)).toBe(claim);
    expect(supportedAnswerText(`Đầu tiên, ${claim}`, [WALKING], QUESTION)).toBe(claim);
    const { puts, CONFIG } = memoryConfig();
    await writeAnswerCache({ CONFIG } as unknown as Env, `${QUESTION} t01`, {
      classification: "health_education",
      answer: "— WHO [S1] ".repeat(12),
      sources: [WALKING],
    });
    expect(puts).toEqual([]);
  });

  it("matches who.int by registrable domain and drops a dangling preposition", () => {
    const apex =
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn (https://who.int/news-room/fact-sheets/detail/ageing-and-health). [S1]";
    const kept = groundedSentence(apex, [WALKING], QUESTION);
    expect(kept).toContain("https://who.int/news-room/fact-sheets/detail/ageing-and-health");
    const dangling = groundedSentence(
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn tại https://baohiemxahoi.gov/Pages. [S1]",
      [WALKING],
      QUESTION,
    );
    expect(dangling).toContain("hướng dẫn");
    expect(dangling).not.toMatch(/tại\s*\[S1\]/i);
    expect(dangling).not.toContain("baohiemxahoi.gov");
    const english = groundedSentence(
      "Người 61 tuổi nên duy trì nhịp đi bộ buổi sáng để giữ sức khỏe theo hướng dẫn at https://moh.gov/huong. [S1]",
      [WALKING],
      QUESTION,
    );
    expect(english).not.toMatch(/\bat\s*\[S1\]/i);
    expect(english).not.toContain("moh.gov");
  });

  it("treats an inserted operator token as non-extractive", () => {
    const fillers = [
      "người",
      "bệnh",
      "ngồi",
      "nghỉ",
      "trong",
      "phòng",
      "khách",
      "uống",
      "nước",
      "lọc",
      "nghe",
      "hướng",
      "dẫn",
      "gia",
      "đình",
      "về",
      "dinh",
      "dưỡng",
      "hằng",
      "buổi",
    ];
    const careWords = ["bác sĩ", "bệnh viện", "thuốc", "ambulance", "clinic"];
    const surface: Record<string, string> = {
      khong: "không",
      chua: "chưa",
      chang: "chẳng",
      dung: "đừng",
      khoi: "khỏi",
      dont: "don't",
      shouldnt: "shouldn't",
      isnt: "isn't",
      doesnt: "doesn't",
      neednt: "needn't",
      "han che": "hạn chế",
      "gioi han": "giới hạn",
      "bo qua": "bỏ qua",
      ngay: "ngày",
      tuan: "tuần",
      doi: "đợi",
      cho: "chờ",
    };
    const operators = [
      ...NEGATOR_TOKENS,
      ...MODAL_TOKENS,
      ...TIME_TOKENS,
      ...LIMITER_TOKENS,
    ].map((token) => surface[token] ?? token);
    let seed = 0x1a2b3c4d;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let n = 0; n < 12; n += 1) {
      const words = ["The", "reading", "says"];
      const count = 12 + Math.floor(next() * 6);
      for (let i = 0; i < count; i += 1) {
        words.push(fillers[Math.floor(next() * fillers.length)] ?? "ngồi");
      }
      words.push(careWords[Math.floor(next() * careWords.length)] ?? "bác sĩ");
      const sentence = `${words.join(" ")}.`;
      const source = [{ ...WALKING, title: "Reading", snippet: sentence }];
      expect(isExtractiveCareSentence(sentence, source), sentence).toBe(true);
      const operator = operators[Math.floor(next() * operators.length)] ?? "not";
      const at = 1 + Math.floor(next() * (words.length - 1));
      const inserted = [...words];
      inserted.splice(at, 0, operator);
      const changed = `${inserted.join(" ")}.`;
      expect(isExtractiveCareSentence(changed, source), changed).toBe(false);
    }
    const long =
      "Call an ambulance when the person is unable to stand up after a fall at home and needs help from a doctor nearby.";
    const longSource = [{ ...WALKING, snippet: long }];
    expect(isExtractiveCareSentence(long, longSource)).toBe(true);
    for (const operator of operators) {
      const changed = long.replace(/\.$/, ` ${operator}.`);
      expect(isExtractiveCareSentence(changed, longSource), operator).toBe(false);
    }
  });
});
