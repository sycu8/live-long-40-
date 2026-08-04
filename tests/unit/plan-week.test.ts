import { describe, expect, it } from "vitest";
import { currentPlanWeek } from "../../client/lib/plan-week";

describe("currentPlanWeek", () => {
  it("returns 1 for start day", () => {
    const start = "2026-08-01T00:00:00.000Z";
    expect(currentPlanWeek(start, Date.parse(start))).toBe(1);
  });

  it("returns 2 after 7 days", () => {
    const start = "2026-08-01T00:00:00.000Z";
    expect(currentPlanWeek(start, Date.parse(start) + 7 * 86_400_000)).toBe(2);
  });

  it("caps at week 4", () => {
    const start = "2026-08-01T00:00:00.000Z";
    expect(currentPlanWeek(start, Date.parse(start) + 40 * 86_400_000)).toBe(4);
  });

  it("falls back to 1 on invalid date", () => {
    expect(currentPlanWeek("not-a-date")).toBe(1);
  });
});
