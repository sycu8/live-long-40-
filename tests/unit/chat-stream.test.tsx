// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "../../client/pages/ChatPage";

const FULL_ANSWER = "Người cao tuổi cần theo dõi huyết áp tại nhà.";
const CITATION_TITLE = "Hướng dẫn theo dõi huyết áp";
const MESSAGE_PUBLIC_ID = "msg_01HZXNGUOI";

const STREAM_EVENTS = [
  {
    type: "meta",
    classification: "health",
    riskClass: "none",
    messagePublicId: MESSAGE_PUBLIC_ID,
  },
  { type: "token", text: "Người" },
  { type: "token", text: " cao tuổi" },
  { type: "token", text: " cần theo dõi huyết áp tại nhà." },
  {
    type: "sources",
    sources: [
      {
        key: "BYT",
        title: CITATION_TITLE,
        issuer: "Bộ Y tế",
        date: "2024-03-01",
        url: "https://moh.gov.vn/huong-dan-theo-doi-huyet-ap",
        snippet: "Đo huyết áp tại nhà vào buổi sáng.",
      },
    ],
  },
  { type: "done", abstained: false },
];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** One SSE event per pull, with a macrotask gap so React commits between tokens. */
function sseStream(events: unknown[]) {
  const encoder = new TextEncoder();
  const chunks = events.map((event) =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
  );
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[index]!;
      index += 1;
      // "Người" is a multi-byte UTF-8 token; deliver its event in two slices.
      if (index === 2) {
        const splitAt = chunk.findIndex((byte, i) => i > 0 && (byte & 0xc0) === 0x80);
        controller.enqueue(chunk.slice(0, splitAt));
        await new Promise((resolve) => setTimeout(resolve, 30));
        controller.enqueue(chunk.slice(splitAt));
      } else {
        controller.enqueue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    },
  });
}

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/v1/session") && method === "POST") {
        return jsonResponse({ csrfToken: "csrf-test" });
      }
      if (url.endsWith("/api/v1/meta")) {
        return jsonResponse({ chatHistoryDefault: false });
      }
      if (url.endsWith("/api/v1/chat/sessions") && method === "POST") {
        return jsonResponse({ chatSessionPublicId: "sess_public_1" });
      }
      if (url.endsWith("/messages") && method === "POST") {
        return new Response(sseStream(STREAM_EVENTS), {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }),
  );
}

describe("ChatPage streamed answers", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    localStorage.clear();
    installFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("appends every token, including a Vietnamese token, and shows citations after done", async () => {
    render(
      <MemoryRouter initialEntries={["/hoi"]}>
        <ChatPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Câu hỏi của bạn");
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });

    fireEvent.change(input, { target: { value: "Huyết áp tại nhà?" } });
    fireEvent.submit(input.closest("form")!);

    const answer = await screen.findByText(FULL_ANSWER, undefined, { timeout: 4000 });
    const citation = await screen.findByRole(
      "button",
      { name: `[BYT] ${CITATION_TITLE}` },
      { timeout: 4000 },
    );
    expect(answer.textContent).toBe(FULL_ANSWER);
    expect(answer.textContent).not.toBe("Người");
    expect(answer.parentElement?.contains(citation)).toBe(true);
    expect(answer.parentElement?.getAttribute("data-message-public-id")).toBe(
      MESSAGE_PUBLIC_ID,
    );
    expect(await screen.findByText("Câu trả lời này hữu ích?")).toBeTruthy();
  });
});
