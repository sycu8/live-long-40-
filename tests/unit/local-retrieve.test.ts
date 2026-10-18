import { describe, expect, it } from "vitest";
import {
  foldVietnamese,
  isCompleteHttpUrl,
  MIN_RETRIEVAL_SCORE,
  OFFICIAL_TOPIC_FLOOR,
  rankLocalKnowledge,
  scoreTextAgainstQuery,
  scoreTextInCorpus,
  type LocalChunkRow,
} from "../../worker/ai/local-retrieve";

describe("foldVietnamese", () => {
  it("removes diacritics and maps đ", () => {
    expect(foldVietnamese("Quỹ dự phòng")).toBe("quy du phong");
    expect(foldVietnamese("Đi bộ đều")).toBe("di bo deu");
  });
});

describe("scoreTextAgainstQuery", () => {
  it("matches ASCII queries to accented Vietnamese content", () => {
    const content =
      "Quỹ dự phòng giúp chi trả các việc đột xuất. Đặt mục tiêu nhỏ và đều đặn.";
    expect(scoreTextAgainstQuery(content, "quy du phong la gi")).toBeGreaterThan(0.4);
    expect(scoreTextAgainstQuery(content, "quy du phong")).toBeGreaterThan(0.4);
    expect(scoreTextAgainstQuery(content, "đầu tư chứng khoán")).toBe(0);
  });
});

describe("rankLocalKnowledge", () => {
  it("ranks fund chunk above fall chunk for reserve query", () => {
    const ranked = rankLocalKnowledge(
      "Tôi nên chuẩn bị quỹ dự phòng thế nào?",
      [
        {
          chunk_id: "fall",
          content: "Phòng ngã tại nhà. Giữ lối đi thông thoáng.",
          heading: "Phòng ngã",
          source_id: "src_fall",
          title: "Hướng dẫn giáo dục về phòng ngã tại nhà",
          issuer: "VivaAge",
          status: "active",
        },
        {
          chunk_id: "fund",
          content:
            "Quỹ dự phòng giúp chi trả việc đột xuất. Ước lượng chi phí thiết yếu mỗi tháng.",
          heading: "Quỹ dự phòng",
          source_id: "src_fund",
          title: "Giáo dục về quỹ dự phòng",
          issuer: "VivaAge",
          status: "active",
        },
      ],
      [],
      3,
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.chunkId).toBe("fund");
    expect(ranked[0]?.key).toBe("S1");
  });

  it("can use library lessons when chunks miss", () => {
    const ranked = rankLocalKnowledge(
      "Cần chuẩn bị giấy tờ nào cho tuổi già?",
      [],
      [
        {
          slug: "giay-to",
          title: "Sắp xếp giấy tờ quan trọng",
          summary: "Gom giấy tùy thân, bảo hiểm và giấy tờ nhà.",
          body_markdown:
            "# Giấy tờ\n\nChuẩn bị giấy tờ cho tuổi già: CMND/CCCD, bảo hiểm, giấy nhà.",
          issuer: "VivaAge",
          publication_date: "2026-01-01",
        },
      ],
      3,
    );
    expect(ranked[0]?.title).toMatch(/giấy tờ/i);
  });

  it("keeps a topical official source the 97% band would hide behind an off-topic hit", () => {
    const query = "Người lớn nên vận động thể chất bao nhiêu phút mỗi tuần";
    const activity: LocalChunkRow = {
      chunk_id: "activity",
      content: `${"Lời mở đầu không nói tới chủ đề này. ".repeat(40)} Người lớn nên vận động thể chất mỗi tuần và bớt ngồi lâu.`,
      heading: "Vận động",
      source_id: "who-physical-activity",
      title: "Vận động thể chất — Tổ chức Y tế Thế giới",
      issuer: "Tổ chức Y tế Thế giới (WHO)",
      trust_tier: "intl_guideline",
      status: "active",
    };
    const distractor: LocalChunkRow = {
      chunk_id: "pressure",
      content: `${query}. ${query}. Huyết áp cao cần được theo dõi tại nhà mỗi ngày.`,
      heading: "Huyết áp",
      source_id: "who-hypertension",
      title: "Huyết áp cao — tờ hướng dẫn",
      issuer: "Tổ chức Y tế Thế giới (WHO)",
      trust_tier: "intl_guideline",
      status: "active",
    };
    const ranked = rankLocalKnowledge(query, [activity, distractor], [], 3);
    expect(ranked.map((source) => source.sourceId)).toContain("who-physical-activity");
    expect(ranked.map((source) => source.sourceId)).not.toContain("who-hypertension");
  });

  it("uses the 0.25 floor for WHO, Bộ Y tế, and CDC only after the topic gate", () => {
    expect(OFFICIAL_TOPIC_FLOOR).toBe(0.25);
    expect(MIN_RETRIEVAL_SCORE).toBe(0.28);
    const query = "cholesterol vận động lipoprotein statin fibrate insulin metformin";
    const body = "cholesterol. lipoprotein. statin. fibrate. insulin. metformin.";
    const shared = {
      chunk_id: "chol",
      content: body,
      heading: "Ghi chú",
      title: "Ghi chú lâm sàng",
      status: "active" as const,
    };
    const official: LocalChunkRow = {
      ...shared,
      source_id: "who-cholesterol",
      issuer: "Tổ chức Y tế Thế giới (WHO)",
      trust_tier: "intl_guideline",
    };
    const ministry: LocalChunkRow = {
      ...shared,
      chunk_id: "byt",
      source_id: "byt-cholesterol",
      issuer: "Bộ Y tế Việt Nam",
      trust_tier: "official_vn",
    };
    const cdc: LocalChunkRow = {
      ...shared,
      chunk_id: "cdc",
      source_id: "cdc-cholesterol",
      issuer: "Centers for Disease Control and Prevention",
      trust_tier: "official_vn",
    };
    const blog: LocalChunkRow = {
      ...shared,
      chunk_id: "blog",
      source_id: "blog-cholesterol",
      issuer: "Trang tin sức khỏe",
      trust_tier: "community",
    };
    const corpus = [foldVietnamese(`${official.title}\n${official.heading ?? ""}\n${official.content}`)];
    const titleScore = scoreTextInCorpus(`${official.title}\n${official.heading}`, query, corpus);
    const bodyScore = scoreTextInCorpus(official.content, query, corpus);
    const score = Math.max(titleScore * 1.25, bodyScore, (titleScore + bodyScore) / 2);
    expect(score, `score ${score}`).toBeGreaterThanOrEqual(OFFICIAL_TOPIC_FLOOR);
    expect(score, `score ${score}`).toBeLessThan(MIN_RETRIEVAL_SCORE);
    expect(rankLocalKnowledge(query, [official], [], 3).map((source) => source.sourceId)).toContain(
      "who-cholesterol",
    );
    expect(rankLocalKnowledge(query, [ministry], [], 3).map((source) => source.sourceId)).toContain(
      "byt-cholesterol",
    );
    expect(rankLocalKnowledge(query, [cdc], [], 3).map((source) => source.sourceId)).toContain(
      "cdc-cholesterol",
    );
    expect(rankLocalKnowledge(query, [blog], [], 3)).toEqual([]);
  });
});

describe("isCompleteHttpUrl", () => {
  it("rejects a token that ends in a hyphen or a dot", () => {
    expect(isCompleteHttpUrl("https://www.who.int/news-room/fact-sheets/detail/ageing-")).toBe(
      false,
    );
    expect(isCompleteHttpUrl("https://www.who.int/news-room/fact-sheets/detail/ageing.")).toBe(
      false,
    );
    expect(
      isCompleteHttpUrl("https://www.who.int/news-room/fact-sheets/detail/ageing-and-health"),
    ).toBe(true);
    expect(isCompleteHttpUrl("https://www.who.int")).toBe(true);
  });
});
