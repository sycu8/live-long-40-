import { describe, expect, it } from "vitest";
import { weekEncouragement } from "../../client/content/momentum";

describe("weekEncouragement", () => {
  it("handles empty plan", () => {
    expect(weekEncouragement(0, 0)).toMatch(/kế hoạch/i);
  });

  it("encourages starting", () => {
    expect(weekEncouragement(0, 3)).toMatch(/vừa sức/i);
  });

  it("celebrates completion", () => {
    expect(weekEncouragement(3, 3)).toMatch(/hoàn thành/i);
  });
});
