import { describe, expect, it } from "vitest";
import { themeLabel } from "../../worker/api/blog";

describe("blog helpers", () => {
  it("maps known themes to Vietnamese labels", () => {
    expect(themeLabel("tinh-than")).toBe("Tinh thần");
    expect(themeLabel("tai-chinh")).toBe("Tài chính bình tĩnh");
    expect(themeLabel("unknown-theme")).toBe("unknown-theme");
  });
});
