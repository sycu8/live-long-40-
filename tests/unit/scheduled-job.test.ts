import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class WorkflowEntrypoint {},
}));

vi.mock("../../worker/blog/schedule", () => ({
  runBlogDailyJob: vi.fn(),
}));

import worker from "../../worker/index";
import { runBlogDailyJob } from "../../worker/blog/schedule";

describe("scheduled blog job", () => {
  beforeEach(() => {
    vi.mocked(runBlogDailyJob).mockReset();
  });

  it("logs blog_daily_job_failed when the job rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(runBlogDailyJob).mockRejectedValue(new Error("d1 down"));
    let pending: Promise<unknown> = Promise.resolve();
    await worker.scheduled(
      {} as never,
      {} as never,
      {
        waitUntil(task: Promise<unknown>) {
          pending = task;
        },
      } as never,
    );
    await pending;
    expect(error).toHaveBeenCalled();
    const payload = JSON.parse(String(error.mock.calls[0]?.[0])) as {
      message?: string;
      error?: string;
    };
    expect(payload.message).toBe("blog_daily_job_failed");
    expect(payload.error).toBe("d1 down");
  });
});
