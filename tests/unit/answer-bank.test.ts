import { describe, expect, it } from "vitest";
import { ANSWER_BANK } from "../../shared/content/answer-bank";
import { OFFICIAL_SOURCES } from "../../shared/content/official-sources";
import { EXAMPLE_QUESTIONS } from "../../shared/constants/product";
import {
  isOfficialIssuer,
  answerHasCitations,
  sourceLooksOfficial,
} from "../../shared/rules/sources";
import {
  bankEntryToCached,
  cacheKeyForQuestion,
  isGroundedOfficialAnswer,
  matchAnswerBank,
} from "../../worker/ai/answer-cache";

describe("answer bank official sources", () => {
  it("covers all example questions with detailed answers", () => {
    for (const q of EXAMPLE_QUESTIONS) {
      const hit = matchAnswerBank(q);
      expect(hit, q).toBeTruthy();
      expect(hit!.answer.length).toBeGreaterThan(280);
      expect(hit!.sources.length).toBeGreaterThan(0);
    }
  });

  it("attaches official issuers and https URLs on every bank source", () => {
    for (const entry of ANSWER_BANK) {
      expect(answerHasCitations(entry.answer)).toBe(true);
      for (const s of entry.sources) {
        expect(s.url.startsWith("https://")).toBe(true);
        expect(isOfficialIssuer(s.issuer)).toBe(true);
        expect(s.trustTier === "official_vn" || s.trustTier === "intl_guideline").toBe(
          true,
        );
      }
      const cached = bankEntryToCached(entry);
      expect(isGroundedOfficialAnswer(cached)).toBe(true);
    }
  });

  it("matches ASCII paraphrases", () => {
    expect(matchAnswerBank("quy du phong la gi")?.id).toBe("emergency-fund");
    expect(matchAnswerBank("lam gi khi cha me bi nga")?.id).toBe("parent-fall");
    expect(matchAnswerBank("tu tuoi 40 toi nen kiem tra suc khoe gi")?.id).toBe(
      "health-check-40",
    );
  });

  it("maps bank entries to citation keys S1..Sn with urls", () => {
    const entry = ANSWER_BANK[0]!;
    const cached = bankEntryToCached(entry);
    expect(cached.sources[0]?.key).toBe("S1");
    expect(cached.sources[0]?.url).toMatch(/^https:\/\//);
    expect(cached.mode).toBe("answer_bank");
    expect(cached.answer).toContain("[S1]");
  });

  it("builds stable cache keys for equivalent folded questions", () => {
    const a = cacheKeyForQuestion("Quỹ dự phòng là gì?");
    const b = cacheKeyForQuestion("quy du phong la gi?");
    expect(a.split("_")[0]).toBe(b.split("_")[0]);
  });
});

describe("official source registry", () => {
  it("lists only official_vn / intl_guideline entries with urls", () => {
    expect(OFFICIAL_SOURCES.length).toBeGreaterThanOrEqual(6);
    for (const s of OFFICIAL_SOURCES) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(sourceLooksOfficial(s)).toBe(true);
    }
  });
});
