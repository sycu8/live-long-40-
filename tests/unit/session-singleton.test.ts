import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("ensureSession singleton", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent session bootstraps to one network call", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return new Response(
          JSON.stringify({ csrfToken: "csrf_test", sessionPublicId: "ps_x" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    vi.stubGlobal("document", {
      cookie: "",
    });

    const mod = await import("../../client/lib/api");
    const [a, b] = await Promise.all([mod.ensureSession(), mod.ensureSession()]);
    expect(a.csrfToken).toBe("csrf_test");
    expect(b.csrfToken).toBe("csrf_test");
    expect(calls).toBe(1);
  });

  it("reuses sa_csrf cookie and skips POST /api/v1/session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", {
      cookie: "sa_csrf=csrf_from_cookie; other=1",
    });

    const mod = await import("../../client/lib/api");
    const result = await mod.ensureSession();
    expect(result.csrfToken).toBe("csrf_from_cookie");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
