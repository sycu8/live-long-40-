import { describe, expect, it } from "vitest";
import {
  foldVietnamese,
  rankLocalKnowledge,
  scoreTextAgainstQuery,
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
  it("ranks fund chunk above unrelated fall chunk for reserve query", () => {
    const ranked = rankLocalKnowledge(
      "Tôi nên chuẩn bị quỹ dự phòng thế nào?",
      [
        {
          chunk_id: "fall",
          content: "Phòng ngã tại nhà. Giữ lối đi thông thoáng.",
          heading: "Phòng ngã",
          source_id: "src_fall",
          title: "Hướng dẫn phòng ngã",
          issuer: "Sống An",
          status: "active",
        },
        {
          chunk_id: "fund",
          content:
            "Quỹ dự phòng giúp chi trả việc đột xuất. Ước lượng chi phí thiết yếu mỗi tháng.",
          heading: "Quỹ dự phòng",
          source_id: "src_fund",
          title: "Giáo dục về quỹ dự phòng",
          issuer: "Sống An",
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
          issuer: "Sống An",
          publication_date: "2026-01-01",
        },
      ],
      3,
    );
    expect(ranked[0]?.title).toMatch(/giấy tờ/i);
  });
});
