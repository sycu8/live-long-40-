import { describe, expect, it } from "vitest";
import { presentCitations, stripUnkeptCitationMarkers } from "../../shared/citations";

describe("citation display", () => {
  it("drops a duplicate chip and its marker", () => {
    const sources = [
      {
        key: "S1",
        title: "Ngã",
        url: "https://www.who.int/news-room/fact-sheets/detail/falls",
      },
      {
        key: "S2",
        title: "Ngã",
        url: "https://www.who.int/news-room/fact-sheets/detail/falls",
      },
    ];
    const presented = presentCitations("Giữ nhà cửa thông thoáng. [S1][S2]", sources);
    expect(presented.sources.map((source) => source.key)).toEqual(["S1"]);
    expect(presented.text).not.toContain("[S2]");
    expect(presentCitations("Đi bộ buổi sáng.", sources).sources).toEqual([]);
    expect(presentCitations("Đi bộ. [S1] [S1]", sources).text.match(/\[S1\]/g)?.length).toBe(
      1,
    );
    expect(presented.text).toContain("[S1]");
    expect(
      stripUnkeptCitationMarkers("Giữ nhà. [S1][S2]", presented.sources),
    ).not.toContain("[S2]");
  });
});
