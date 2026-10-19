// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ChatPage } from "../../client/pages/ChatPage";
import { evaluateHighRisk } from "../../shared/rules/safety";

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
      const text = new TextDecoder().decode(chunk);
      if (afterReady && text.includes('"ready"')) await afterReady;
      await new Promise((resolve) => setTimeout(resolve, 30));
    },
  });
}

let streamEvents: unknown[] = STREAM_EVENTS;
let afterReady: Promise<void> | null = null;

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
        return new Response(sseStream(streamEvents), {
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
    streamEvents = STREAM_EVENTS;
    afterReady = null;
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

    expect((await screen.findByRole("status")).textContent).toMatch(
      /Đang soạn câu trả lời/,
    );
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

  it("renders a multi-token 115 emergency message on the stream path", async () => {
    const message = evaluateHighRisk(
      "Bố tôi 65 tuổi bị đau tức ngực bên trái và vã mồ hôi từ nửa tiếng nay",
    ).message;
    const parts = message.split(/\n\n/).filter((part) => part.length > 0);
    expect(parts.length).toBeGreaterThanOrEqual(3);
    streamEvents = [
      {
        type: "meta",
        classification: "high_risk_health",
        riskClass: "chest_pain",
        messagePublicId: "msg_emergency_115",
      },
      ...parts.map((part, index) => ({
        type: "token",
        text: index === 0 ? part : `\n\n${part}`,
      })),
      { type: "done", abstained: false },
    ];

    render(
      <MemoryRouter initialEntries={["/hoi"]}>
        <ChatPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Câu hỏi của bạn");
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.change(input, { target: { value: "Đau tức ngực và vã mồ hôi" } });
    fireEvent.submit(input.closest("form")!);

    const answer = await screen.findByText(/Không chờ xem có hết không/, undefined, {
      timeout: 4000,
    });
    expect(answer.textContent).toContain("Hãy gọi 115 ngay");
    expect(answer.textContent).toBe(message);
    expect(answer.textContent).toContain("Nên làm:");
    expect(answer.textContent).toContain("Không nên:");
    expect(answer.textContent).not.toContain("chưa tìm thấy đủ nguồn");
  });

  it("unlocks the composer on ready, before the stream ends", async () => {
    let release = () => undefined as void;
    afterReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    streamEvents = [
      {
        type: "meta",
        classification: "high_risk_health",
        riskClass: "unconscious",
        messagePublicId: "msg_ready",
      },
      { type: "token", text: "Gọi 115 ngay." },
      { type: "ready" },
      { type: "token", text: "\n\nỞ lại bên cạnh." },
      { type: "done", abstained: false },
    ];

    render(
      <MemoryRouter initialEntries={["/hoi"]}>
        <ChatPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Câu hỏi của bạn");
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.change(input, { target: { value: "Mẹ tôi lịm đi" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText(/Gọi 115 ngay/, undefined, { timeout: 4000 });
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    expect(screen.queryByText("Câu trả lời này hữu ích?")).toBeNull();
    release();
    expect(await screen.findByText("Câu trả lời này hữu ích?")).toBeTruthy();
    expect(screen.getByText(/Ở lại bên cạnh/)).toBeTruthy();
  });

  it("replaces the first screen so the crisis block comes first", async () => {
    streamEvents = [
      {
        type: "meta",
        classification: "high_risk_health",
        riskClass: "poisoning",
        messagePublicId: "msg_ord",
      },
      { type: "token", text: "Không tự gây nôn trước khi xác nhận." },
      { type: "ready" },
      {
        type: "token",
        replace: true,
        text: "Ở lại bên cạnh người bệnh.\n\nKhông tự gây nôn.",
      },
      { type: "done", abstained: false },
    ];

    render(
      <MemoryRouter initialEntries={["/hoi"]}>
        <ChatPage />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText("Câu hỏi của bạn");
    await vi.waitFor(() => {
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
    fireEvent.change(input, { target: { value: "Ông nuốt cả vỉ thuốc" } });
    fireEvent.submit(input.closest("form")!);

    const answer = await screen.findByText(/Ở lại bên cạnh/, undefined, {
      timeout: 4000,
    });
    const text = answer.textContent ?? "";
    expect(text.indexOf("Ở lại bên cạnh")).toBeLessThan(text.indexOf("Không tự gây nôn"));
    expect(text).not.toContain("trước khi xác nhận");
  });
});
