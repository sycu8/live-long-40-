import { describe, expect, it } from "vitest";
import {
  TEXT_SCALE_OPTIONS,
  parseTextScale,
} from "../../client/lib/textScale";

describe("textScale", () => {
  it("parses known scales and defaults to comfortable", () => {
    expect(parseTextScale("large")).toBe("large");
    expect(parseTextScale("default")).toBe("default");
    expect(parseTextScale("comfortable")).toBe("comfortable");
    expect(parseTextScale(null)).toBe("comfortable");
    expect(parseTextScale("huge")).toBe("comfortable");
  });

  it("offers three Vietnamese labels for profile UI", () => {
    expect(TEXT_SCALE_OPTIONS.map((o) => o.id)).toEqual([
      "default",
      "comfortable",
      "large",
    ]);
    expect(TEXT_SCALE_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});
