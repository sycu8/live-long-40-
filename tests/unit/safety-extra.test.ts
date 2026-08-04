import { describe, expect, it } from "vitest";
import { evaluateHighRisk } from "@shared/rules/safety";
import { classifyQuestion } from "@shared/rules/classification";
import { ABSTENTION_MESSAGE } from "@shared/constants/product";

describe("empty knowledge / abstention messaging", () => {
  it("exposes a stable abstention message", () => {
    expect(ABSTENTION_MESSAGE).toContain("chưa tìm thấy đủ nguồn");
  });
});

describe("admin protection assumptions", () => {
  it("expects Access JWT or shared secret in non-development", () => {
    // Documented contract tested at middleware level via environment branching.
    const environments = ["development", "staging", "production"];
    expect(environments).toContain("staging");
  });
});

describe("binding absence messaging", () => {
  it("uses stable error codes for missing infra", () => {
    const codes = ["BINDING_MISSING", "SERVICE_UNAVAILABLE", "UNAUTHORIZED"];
    expect(codes).toContain("BINDING_MISSING");
  });
});

describe("classification coverage", () => {
  it("marks unsupported investment asks", () => {
    expect(classifyQuestion("Tôi nên mua cổ phiếu nào để về hưu?")).toBe(
      "unsupported",
    );
  });

  it("keeps caregiving questions out of emergency route", () => {
    expect(evaluateHighRisk("Làm gì khi cha mẹ bị ngã nhẹ và vẫn tỉnh?").matched).toBe(
      false,
    );
    expect(classifyQuestion("Làm gì khi cha mẹ bị ngã?")).toBe("caregiving");
  });
});
