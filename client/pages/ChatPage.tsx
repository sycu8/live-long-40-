import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { api, getCsrfToken } from "../lib/api";
import { EXAMPLE_QUESTIONS } from "@shared/constants/product";

type Source = {
  key: string;
  title: string;
  issuer: string;
  date?: string;
  url?: string;
  snippet?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  kind?: string;
};

export function ChatPage() {
  const [params] = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerSource, setDrawerSource] = useState<Source | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ chatSessionPublicId: string }>("/chat/sessions", {
          method: "POST",
          body: { historyOptIn: false },
        });
        setSessionId(data.chatSessionPublicId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không mở được phiên chat.");
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send(question?: string) {
    const content = (question ?? input).trim();
    if (!content || !sessionId || streaming) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content }]);
    setStreaming(true);

    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: assistantId, role: "assistant", content: "", sources: [] },
    ]);

    try {
      const res = await fetch(`/api/v1/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken() ?? "",
        },
        body: JSON.stringify({ content }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          messagePublicId: string;
          content: string;
          sources?: Source[];
          kind?: string;
          error?: { message: string };
        };
        if (!res.ok) throw new Error(data.error?.message ?? "Gửi câu hỏi thất bại.");
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  id: data.messagePublicId,
                  content: data.content,
                  sources: data.sources ?? [],
                  kind: data.kind,
                }
              : msg,
          ),
        );
        setFeedbackFor(data.messagePublicId);
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error("Không nhận được phản hồi.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let messagePublicId = assistantId;
      let sources: Source[] = [];
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            messagePublicId?: string;
            sources?: Source[];
            message?: string;
            code?: string;
          };
          if (payload.type === "meta" && payload.messagePublicId) {
            messagePublicId = payload.messagePublicId;
          }
          if (payload.type === "sources" && payload.sources) {
            sources = payload.sources;
          }
          if (payload.type === "token" && payload.text) {
            text += payload.text;
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, id: messagePublicId, content: text, sources }
                  : msg,
              ),
            );
          }
          if (payload.type === "error") {
            throw new Error(payload.message ?? "Luồng trả lời lỗi.");
          }
          if (payload.type === "done") {
            setFeedbackFor(messagePublicId);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được câu hỏi.");
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId && !msg.content
            ? {
                ...msg,
                content:
                  "Xin lỗi, hệ thống tạm thời không trả lời được. Vui lòng thử lại.",
              }
            : msg,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  async function sendFeedback(helpful: boolean) {
    if (!feedbackFor) return;
    try {
      await api("/feedback/ai-answer", {
        method: "POST",
        body: { messagePublicId: feedbackFor, helpful },
      });
      setFeedbackFor(null);
    } catch {
      /* ignore */
    }
  }

  return (
    <AppShell>
      <div className="flex min-h-[70dvh] flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl">Hỏi Sống An</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Câu trả lời dựa trên nguồn đã duyệt. Có thể gõ tiếng Việt không dấu.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Gợi ý câu hỏi</p>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="block w-full rounded-lg bg-white/70 px-3 py-3 text-left text-[var(--color-blue)]"
                onClick={() => send(q)}
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-4" aria-live="polite">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "ml-6 bg-[var(--color-green-soft)]"
                    : "mr-2 bg-white/80"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.sources && m.sources.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.sources.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className="rounded-md bg-[var(--color-blue-soft)] px-2 py-1 text-sm text-[var(--color-blue)]"
                        onClick={() => setDrawerSource(s)}
                      >
                        [{s.key}] {s.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {feedbackFor ? (
          <div className="flex items-center gap-2 text-sm">
            <span>Câu trả lời này hữu ích?</span>
            <Button variant="secondary" onClick={() => sendFeedback(true)}>
              Có
            </Button>
            <Button variant="ghost" onClick={() => sendFeedback(false)}>
              Chưa
            </Button>
          </div>
        ) : null}

        <form
          className="sticky bottom-20 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="chat-input">
            Câu hỏi của bạn
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập câu hỏi…"
            className="min-h-12 flex-1 rounded-xl border border-[var(--color-sand)] bg-white px-4 text-base"
            disabled={streaming || !sessionId}
          />
          <Button type="submit" disabled={streaming || !sessionId || !input.trim()}>
            Gửi
          </Button>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      {drawerSource ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết nguồn"
          onClick={() => setDrawerSource(null)}
        >
          <div
            className="max-h-[80dvh] w-full max-w-lg overflow-auto rounded-t-2xl bg-[var(--color-cream)] p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl">{drawerSource.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {drawerSource.issuer}
              {drawerSource.date ? ` · ${drawerSource.date}` : ""}
            </p>
            {drawerSource.url ? (
              <p className="mt-2 break-all text-sm text-[var(--color-blue)]">
                {drawerSource.url}
              </p>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-[var(--color-ink)]">
              {drawerSource.snippet}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => setDrawerSource(null)}>
              Đóng
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
