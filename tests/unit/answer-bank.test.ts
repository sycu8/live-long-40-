import { describe, expect, it } from "vitest";
import { ANSWER_BANK } from "../../shared/content/answer-bank";
import {
  FORBIDDEN_HOMEPAGE_URLS,
  OFFICIAL_SOURCES,
  isGenericHomepageUrl,
} from "../../shared/content/official-sources";
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
import { WORKERS_AI_TEXT_MODEL } from "../../worker/ai/models";

describe("answer bank official sources", () => {
  it("covers all example questions with detailed answers", () => {
    for (const q of EXAMPLE_QUESTIONS) {
      const hit = matchAnswerBank(q);
      expect(hit, q).toBeTruthy();
      expect(hit!.answer.length).toBeGreaterThan(280);
      expect(hit!.sources.length).toBeGreaterThan(0);
    }
  });

  it("attaches official issuers and document-level https URLs on every bank source", () => {
    for (const entry of ANSWER_BANK) {
      expect(answerHasCitations(entry.answer)).toBe(true);
      for (const s of entry.sources) {
        expect(s.url.startsWith("https://")).toBe(true);
        expect(isGenericHomepageUrl(s.url), s.url).toBe(false);
        expect(isOfficialIssuer(s.issuer)).toBe(true);
        expect(s.trustTier === "official_vn" || s.trustTier === "intl_guideline").toBe(
          true,
        );
        expect(s.title.length).toBeGreaterThan(12);
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
    const prefix = `ans_cache:v4:${WORKERS_AI_TEXT_MODEL}:`;
    expect(a).toBe(b);
    expect(a.startsWith(prefix)).toBe(true);
    expect(a.slice(prefix.length)).toMatch(/^[0-9a-f]{8}$/);
    expect(a).not.toContain("quy");
    expect(a).not.toContain("ans_cache:v3:");
  });
});

describe("official source registry", () => {
  it("lists only official_vn / intl_guideline entries with document-level urls", () => {
    expect(OFFICIAL_SOURCES.length).toBeGreaterThanOrEqual(8);
    for (const s of OFFICIAL_SOURCES) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(isGenericHomepageUrl(s.url), `${s.id} → ${s.url}`).toBe(false);
      expect(sourceLooksOfficial(s)).toBe(true);
      expect(s.title.toLowerCase()).not.toMatch(/^cổng thông tin/);
    }
  });

  it("flags known organization homepages as generic", () => {
    for (const home of FORBIDDEN_HOMEPAGE_URLS) {
      expect(isGenericHomepageUrl(home)).toBe(true);
    }
    expect(
      isGenericHomepageUrl(
        "https://www.who.int/news-room/fact-sheets/detail/hypertension",
      ),
    ).toBe(false);
  });
});
