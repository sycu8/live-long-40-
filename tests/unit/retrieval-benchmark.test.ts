import { describe, expect, it } from "vitest";
import { OFFICIAL_SOURCES } from "../../shared/content/official-sources";
import { rankLocalKnowledge, type LocalChunkRow } from "../../worker/ai/local-retrieve";

const CHUNKS: LocalChunkRow[] = OFFICIAL_SOURCES.map((source) => ({
  chunk_id: source.id,
  content: source.snippet,
  heading: source.title,
  source_id: source.id,
  title: source.title,
  issuer: source.issuer,
  publication_date: source.publicationDate,
  original_url: source.url,
  status: "active",
  trust_tier: source.trustTier,
}));

/** Fixed health questions. `expect` is the relevant official source, or none. */
export const HEALTH_RETRIEVAL_SET: Array<{ q: string; expect: string | null }> = [
  {
    q: "Huyết áp cao ở người 60 tuổi nên đo và theo dõi thế nào?",
    expect: "who-hypertension",
  },
  {
    q: "Cha mẹ bị ngã trong nhà thì nên xử lý ra sao?",
    expect: "who-falls",
  },
  {
    q: "Người ngoài 40 nên khám sức khỏe định kỳ những gì?",
    expect: "byt-elderly-checkup",
  },
  {
    q: "Người lớn tuổi nên vận động và bớt ngồi lâu như thế nào?",
    expect: "who-physical-activity",
  },
  {
    q: "Mất ngủ kéo dài ảnh hưởng tinh thần người lớn tuổi ra sao?",
    expect: "who-mental-sleep",
  },
  {
    q: "Thuốc kê đơn cần tra cứu giấy đăng ký lưu hành ở đâu?",
    expect: "byt-drug-registration-lookup",
  },
  {
    q: "Già hóa thì nên chuẩn bị sức khỏe từ tuổi ngoài 40 thế nào?",
    expect: "who-ageing",
  },
  {
    q: "Cúm mùa có nên dùng kháng sinh để phòng, và tiêm vắc xin vào tháng mấy ở bán cầu bắc?",
    expect: null,
  },
  {
    q: "Người cao tuổi bị ngã đau nhiều có cần đi cấp cứu không?",
    expect: "who-falls",
  },
  {
    q: "Đi bộ đều có nằm trong khuyến nghị vận động của Tổ chức Y tế Thế giới không?",
    expect: "who-physical-activity",
  },
];

export function measureRetrieval() {
  const rows = HEALTH_RETRIEVAL_SET.map((item) => {
    const ranked = rankLocalKnowledge(item.q, CHUNKS, [], 6);
    const ids = ranked.map((source) => source.sourceId ?? "");
    const top1 = ids[0] ?? null;
    const relevant = item.expect == null ? [] : [item.expect];
    const irrelevant = ids.filter((id) => !relevant.includes(id));
    const top1Ok = item.expect == null ? top1 == null : top1 === item.expect;
    return {
      q: item.q,
      expect: item.expect,
      top1,
      top1Ok,
      returned: ids.length,
      irrelevant: irrelevant.length,
      ids,
      scores: ranked.map((source) => Number(source.score.toFixed(3))),
    };
  });
  const n = rows.length;
  const summary = {
    n,
    top1: rows.filter((row) => row.top1Ok).length,
    irrelevantCitations: rows.reduce((sum, row) => sum + row.irrelevant, 0),
    questionsWithIrrelevant: rows.filter((row) => row.irrelevant > 0).length,
    meanReturned: Number(
      (rows.reduce((sum, row) => sum + row.returned, 0) / n).toFixed(2),
    ),
    abstainOk: rows.filter((row) => row.expect == null && row.returned === 0).length,
  };
  return { summary, rows };
}

const REGRESSIONS: Array<{ q: string; expect: string }> = [
  {
    q: "Cha mẹ bị ngã trong nhà thì nên xử lý ra sao?",
    expect: "who-falls",
  },
  {
    q: "Mất ngủ nhiều đêm liền ở tuổi ngoài 40 thì nên làm gì?",
    expect: "who-mental-sleep",
  },
  {
    q: "Mỗi tuần nên tập thể dục bao nhiêu phút?",
    expect: "who-physical-activity",
  },
  {
    q: "Sau khi nghỉ hưu tôi hay buồn chán, có phải trầm cảm không?",
    expect: "who-mental-sleep",
  },
  {
    q: "Tôi đang uống thuốc tiểu đường, tự ngưng thuốc có được không?",
    expect: "who-hypertension",
  },
];

/**
 * Topics from QA's 36-question set. The original CSV is not in this repo,
 * so the wording is reconstructed. `expect` is the snippet that states the
 * topic, or null when these 10 snippets have nothing on it.
 * Bathroom fall-proofing (B14) is the one answerable question these snippets
 * do not cover: the falls sheet never mentions a bathroom.
 */
const BROAD_36: Array<{ id: string; q: string; expect: string | null }> = [
  { id: "F02", q: "Cha mẹ bị ngã trong nhà thì nên xử lý ra sao?", expect: "who-falls" },
  {
    id: "B10",
    q: "Mất ngủ nhiều đêm liền ở tuổi ngoài 40 thì nên làm gì?",
    expect: "who-mental-sleep",
  },
  {
    id: "B12",
    q: "Mỗi tuần nên tập thể dục bao nhiêu phút?",
    expect: "who-physical-activity",
  },
  {
    id: "B22",
    q: "Sau khi nghỉ hưu tôi hay buồn chán, có phải trầm cảm không?",
    expect: "who-mental-sleep",
  },
  {
    id: "B26",
    q: "Tôi đang uống thuốc tiểu đường, tự ngưng thuốc có được không?",
    expect: "who-hypertension",
  },
  {
    id: "B06",
    q: "Huyết áp cao ở người 60 tuổi nên đo và theo dõi thế nào?",
    expect: "who-hypertension",
  },
  {
    id: "B11",
    q: "Người lớn tuổi nên ngủ mấy tiếng mỗi đêm?",
    expect: "who-mental-sleep",
  },
  {
    id: "F03",
    q: "Người ngoài 40 nên khám sức khỏe định kỳ những gì?",
    expect: "byt-elderly-checkup",
  },
  {
    id: "F04",
    q: "Thuốc kê đơn cần tra cứu giấy đăng ký lưu hành ở đâu?",
    expect: "byt-drug-registration-lookup",
  },
  { id: "F05", q: "Làm sao tra cứu thời hạn thẻ BHYT?", expect: "bhxh-bhyt-card-lookup" },
  {
    id: "F06",
    q: "Thủ tục hưởng lương hưu gồm những giấy tờ gì?",
    expect: "bhxh-pension-procedure",
  },
  {
    id: "F07",
    q: "Nên học quản lý chi tiêu và tiết kiệm ở đâu?",
    expect: "sbv-financial-education",
  },
  {
    id: "F08a",
    q: "Già hóa thì nên chuẩn bị sức khỏe từ tuổi ngoài 40 thế nào?",
    expect: "who-ageing",
  },
  {
    id: "F09",
    q: "Người lớn tuổi nên vận động và bớt ngồi lâu như thế nào?",
    expect: "who-physical-activity",
  },
  {
    id: "F10",
    q: "Người cao tuổi bị ngã đau nhiều có cần đi cấp cứu không?",
    expect: "who-falls",
  },
  {
    id: "B14",
    q: "Sửa phòng tắm thế nào để phòng ngã tại nhà cho cha mẹ?",
    expect: "who-falls",
  },
  { id: "B16", q: "Ăn mặn có làm huyết áp tăng không?", expect: "who-hypertension" },
  {
    id: "F11",
    q: "Đi bộ đều có nằm trong khuyến nghị vận động của Tổ chức Y tế Thế giới không?",
    expect: "who-physical-activity",
  },
  {
    id: "B17",
    q: "Mệt mỏi và mất ngủ kéo dài ở người lớn tuổi thì nên làm gì?",
    expect: "who-mental-sleep",
  },
  {
    id: "B18",
    q: "Người cao tuổi có nên tự ý đổi thuốc không?",
    expect: "byt-elderly-checkup",
  },
  {
    id: "B19",
    q: "Thẻ bảo hiểm y tế hết hạn thì tra cứu ở đâu?",
    expect: "bhxh-bhyt-card-lookup",
  },
  {
    id: "B01",
    q: "Người trên 50 tuổi có nên tiêm vắc xin cúm hàng năm không?",
    expect: null,
  },
  {
    id: "V1",
    q: "Người ngoài 40 tuổi có nên tiêm vắc xin cúm hằng năm không?",
    expect: null,
  },
  { id: "B02", q: "Người lớn tuổi có nên tiêm vắc xin phế cầu không?", expect: null },
  {
    id: "B29",
    q: "Người trên 50 có nên tiêm vắc xin zona thần kinh không?",
    expect: null,
  },
  {
    id: "B09",
    q: "Đường huyết dưới 7 mmol/l có được coi là bình thường không?",
    expect: null,
  },
  { id: "B20", q: "Uống vitamin D có giúp phòng ngã không?", expect: null },
  { id: "B21", q: "Người lớn tuổi có nên bổ sung vitamin D không?", expect: null },
  { id: "B23", q: "Mỗi ngày nên uống bao nhiêu lít nước?", expect: null },
  { id: "B24", q: "Khi nào nên tầm soát ung thư đại tràng?", expect: null },
  { id: "B34", q: "Đau lưng dưới kéo dài thì chườm nóng hay chườm lạnh?", expect: null },
  { id: "B36", q: "Gút thì nên kiêng gì và uống thuốc gì?", expect: null },
  { id: "B27", q: "Hay quên sau 60 tuổi có phải sa sút trí tuệ không?", expect: null },
  {
    id: "B33",
    q: "Muốn giảm cân thì mỗi tuần cần vận động ít nhất bao nhiêu phút?",
    expect: null,
  },
  { id: "B32", q: "Mỗi ngày nên ăn dưới bao nhiêu gam muối?", expect: null },
  {
    id: "B05",
    q: "Nam giới ngoài 50 có nên tầm soát tuyến tiền liệt không?",
    expect: null,
  },
];

describe("retrieval regressions from the 36-question QA set", () => {
  it("retrieves a source for the same topics asked in English", () => {
    const english = [
      {
        q: "How many minutes of exercise should older adults do each week?",
        expect: "who-physical-activity",
      },
      {
        q: "What should I do about insomnia in older adults?",
        expect: "who-mental-sleep",
      },
      { q: "What should I do if a parent falls at home?", expect: "who-falls" },
      { q: "How do I check blood pressure at home?", expect: "who-hypertension" },
      {
        q: "Where do I check my health insurance card?",
        expect: "bhxh-bhyt-card-lookup",
      },
      {
        q: "Where is the pension procedure explained?",
        expect: "bhxh-pension-procedure",
      },
      {
        q: "How should I prepare for old age?",
        expect: "who-ageing",
      },
      {
        q: "Where can I check whether a medicine is licensed?",
        expect: "byt-drug-registration-lookup",
      },
      {
        q: "Is my health insurance card still valid?",
        expect: "bhxh-bhyt-card-lookup",
      },
    ];
    for (const item of english) {
      const ranked = rankLocalKnowledge(item.q, CHUNKS, [], 3);
      expect(ranked.length, item.q).toBeGreaterThan(0);
      expect(ranked[0]?.sourceId, item.q).toBe(item.expect);
    }
  });

  it("still retrieves a source for insomnia, exercise, mood, medicine, and falls", () => {
    for (const item of REGRESSIONS) {
      const ranked = rankLocalKnowledge(item.q, CHUNKS, [], 6);
      expect(ranked.length, item.q).toBeGreaterThan(0);
      expect(ranked[0]?.sourceId, item.q).toBe(item.expect);
    }
  });

  it("keeps irrelevant citations down and recovers the five missed questions", () => {
    expect(BROAD_36).toHaveLength(36);
    let irrelevant = 0;
    let top1 = 0;
    const missed: string[] = [];
    for (const item of BROAD_36) {
      const ranked = rankLocalKnowledge(item.q, CHUNKS, [], 3);
      const ids = ranked.map((source) => source.sourceId ?? "");
      const relevant = item.expect == null ? [] : [item.expect];
      irrelevant += ids.filter((id) => !relevant.includes(id)).length;
      const top = ids[0] ?? null;
      if (item.expect == null ? top == null : top === item.expect) top1 += 1;
      if (item.expect != null && ids.length === 0) missed.push(item.id);
    }
    // Offline on the 10 official snippets, production cap of 3.
    // Failed #42 ranker on this same set: top1 23/36, irrelevant 10,
    // and B10, B12, B22, B14 returned no relevant source.
    // After the topic gate and dropping weak single-token matches:
    // top1 35/36, irrelevant 0. The bathroom question is still the only
    // answerable miss — the falls sheet never mentions a bathroom.
    expect(missed).toEqual(["B14"]);
    expect(top1).toBe(35);
    expect(irrelevant).toBe(0);
  });

  it("does not cite the pension procedure for a BHYT card question", () => {
    const question = "Làm sao tra cứu thời hạn thẻ BHYT?";
    const poisoned = CHUNKS.map((chunk) =>
      chunk.source_id === "bhxh-pension-procedure"
        ? {
            ...chunk,
            content: `${chunk.content} Xem thêm bảo hiểm y tế trên cùng cổng tra cứu.`,
          }
        : chunk,
    );
    const ranked = rankLocalKnowledge(question, poisoned, [], 3);
    const ids = ranked.map((source) => source.sourceId);
    expect(ids).toContain("bhxh-bhyt-card-lookup");
    expect(ids).not.toContain("bhxh-pension-procedure");
  });
});

describe("retrieval benchmark", () => {
  it("keeps the relevant official source and drops the flu question", () => {
    // Baseline on these 10 snippets, top 6, lexical overlap (ec20925):
    // top1 7/10, irrelevantCitations 50, questionsWithIrrelevant 10,
    // meanReturned 5.9, abstainOk 0.
    // QA's manual count of those citations was 47; the automatic
    // "not the expected source" count is 50.
    const measured = measureRetrieval();
    expect(measured.summary).toEqual({
      n: 10,
      top1: 10,
      irrelevantCitations: 0,
      questionsWithIrrelevant: 0,
      meanReturned: 0.9,
      abstainOk: 1,
    });
    for (const row of measured.rows) {
      expect(row.top1Ok).toBe(true);
      if (row.expect == null) expect(row.returned).toBe(0);
    }
  });
});
