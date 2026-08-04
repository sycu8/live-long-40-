import { describe, expect, it } from "vitest";
import { ANSWER_BANK } from "../../shared/content/answer-bank";
import { EXAMPLE_QUESTIONS } from "../../shared/constants/product";
import {
  bankEntryToCached,
  cacheKeyForQuestion,
  matchAnswerBank,
} from "../../worker/ai/answer-cache";

describe("answer bank", () => {
  it("covers all example questions with detailed answers", () => {
    for (const q of EXAMPLE_QUESTIONS) {
      const hit = matchAnswerBank(q);
      expect(hit, q).toBeTruthy();
      expect(hit!.answer.length).toBeGreaterThan(280);
      expect(hit!.sources.length).toBeGreaterThan(0);
    }
  });

  it("matches ASCII paraphrases", () => {
    expect(matchAnswerBank("quy du phong la gi")?.id).toBe("emergency-fund");
    expect(matchAnswerBank("lam gi khi cha me bi nga")?.id).toBe("parent-fall");
    expect(matchAnswerBank("tu tuoi 40 toi nen kiem tra suc khoe gi")?.id).toBe(
      "health-check-40",
    );
  });

  it("maps bank entries to citation keys S1..Sn", () => {
    const entry = ANSWER_BANK[0]!;
    const cached = bankEntryToCached(entry);
    expect(cached.sources[0]?.key).toBe("S1");
    expect(cached.mode).toBe("answer_bank");
    expect(cached.answer).toContain("[S1]");
  });

  it("builds stable cache keys for equivalent folded questions", () => {
    const a = cacheKeyForQuestion("Quỹ dự phòng là gì?");
    const b = cacheKeyForQuestion("quy du phong la gi?");
    // Same fold → same key prefix hash segment
    expect(a.split("_")[0]).toBe(b.split("_")[0]);
  });
});
