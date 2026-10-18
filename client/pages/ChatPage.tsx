import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { api, getCsrfToken } from "../lib/api";
import { EXTENDED_EXAMPLE_QUESTIONS } from "@shared/constants/product";
import { resolveChatHistoryOptIn } from "../lib/preferences";

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
  /** Server id. Kept separate so the local React key stays stable while tokens stream. */
  publicId?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  kind?: string;
};

export function ChatPage() {
  const [params] = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOptIn, setHistoryOptIn] = useState(false);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerSource, setDrawerSource] = useState<Source | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const sendRef = useRef<(question?: string) => Promise<void>>(async () => {});
  const turnRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let productDefault = false;
        try {
          const meta = await api<{ chatHistoryDefault?: boolean }>("/meta");
          productDefault = Boolean(meta.chatHistoryDefault);
        } catch {
          /* ignore */
        }
        const optIn = resolveChatHistoryOptIn(productDefault);
        if (cancelled) return;
        setHistoryOptIn(optIn);

        if (optIn) {
          const latest = await api<{
            chatSessionPublicId: string | null;
            messages: Array<{
              id: string;
              role: "user" | "assistant";
              content: string;
              kind?: string;
            }>;
          }>("/chat/sessions/latest");
          if (cancelled) return;
          if (latest.chatSessionPublicId) {
            setSessionId(latest.chatSessionPublicId);
            setMessages(
              (latest.messages ?? []).map((m) => ({
                id: String(m.id),
                role: m.role,
                content: m.content ?? "",
                kind: m.kind,
              })),
            );
            return;
          }
        }

        const data = await api<{ chatSessionPublicId: string }>("/chat/sessions", {
          method: "POST",
          body: { historyOptIn: optIn },
        });
        if (!cancelled) setSessionId(data.chatSessionPublicId);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Không mở được phiên chat.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send(question?: string) {
    const content = (question ?? input).trim();
    if (!content || !sessionId || streaming) return;
    const turn = ++turnRef.current;
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

      const updateAssistant = (patch: Partial<Message>) => {
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, ...patch } : msg)),
        );
      };

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
            updateAssistant({ publicId: messagePublicId });
          }
          if (
            (payload.type === "sources" || payload.type === "citations") &&
            payload.sources
          ) {
            sources = payload.sources;
            updateAssistant({ publicId: messagePublicId, sources });
          }
          if (payload.type === "token" && payload.text) {
            text += payload.text;
            updateAssistant({ publicId: messagePublicId, content: text, sources });
          }
          if (payload.type === "ready" && turnRef.current === turn) {
            setStreaming(false);
          }
          if (payload.type === "error") {
            throw new Error(payload.message ?? "Luồng trả lời lỗi.");
          }
          if (payload.type === "done") {
            if (payload.sources) sources = payload.sources;
            updateAssistant({ publicId: messagePublicId, content: text, sources });
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
      if (turnRef.current === turn) setStreaming(false);
    }
  }

  sendRef.current = send;

  useEffect(() => {
    const q = params.get("q");
    if (!sessionId || !q || autoSentRef.current) return;
    autoSentRef.current = true;
    void sendRef.current(q);
  }, [sessionId, params]);

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
      <div className="flex min-h-[70dvh] flex-col gap-4 lg:grid lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-3xl lg:text-4xl">Hỏi VivaAge</h1>
            <p className="mt-2 text-[var(--color-ink-muted)]">
              Câu trả lời dựa trên nguồn từ Bộ Y tế, Bảo hiểm xã hội Việt Nam, Ngân hàng
              Nhà nước Việt Nam hoặc Tổ chức Y tế Thế giới. Bạn có thể gõ tiếng Việt không
              dấu.
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              {historyOptIn
                ? "Đang lưu hội thoại theo lựa chọn của bạn."
                : "Hội thoại không được lưu đầy đủ trên máy chủ."}{" "}
              <Link className="text-[var(--color-green)] underline" to="/ho-so">
                Đổi trong Hồ sơ
              </Link>
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="space-y-2 lg:hidden">
              <p className="text-sm font-medium">Gợi ý câu hỏi</p>
              {EXTENDED_EXAMPLE_QUESTIONS.map((q) => (
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
            <div
              className="flex-1 space-y-4 lg:overflow-y-auto lg:pr-2"
              aria-live="polite"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  data-message-public-id={m.publicId}
                  className={`rounded-2xl px-4 py-3 ${
                    m.role === "user"
                      ? "ml-6 bg-[var(--color-green-soft)] lg:ml-16"
                      : "mr-2 bg-white/80 lg:mr-8"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
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
            className="sticky bottom-20 flex gap-2 lg:bottom-4"
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

        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-2xl bg-white/70 p-5">
            <p className="font-display text-lg">Gợi ý câu hỏi</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Chọn một câu hoặc tự hỏi theo cách của bạn.
            </p>
            <ul className="mt-4 space-y-2">
              {EXTENDED_EXAMPLE_QUESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-blue)] transition hover:bg-[var(--color-blue-soft)]"
                    onClick={() => send(q)}
                    disabled={streaming || !sessionId}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
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
            className="max-h-[80dvh] w-full max-w-lg overflow-auto rounded-t-2xl bg-[var(--color-cream)] p-5 sm:rounded-2xl lg:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl">{drawerSource.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {drawerSource.issuer}
              {drawerSource.date ? ` · ${drawerSource.date}` : ""}
            </p>
            <p className="mt-2 text-xs font-medium text-[var(--color-green)]">
              Nguồn từ cơ quan tin cậy
            </p>
            {drawerSource.url ? (
              <a
                href={drawerSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-sm break-all text-[var(--color-blue)] underline"
              >
                Xem tài liệu nguồn: {drawerSource.url}
              </a>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-[var(--color-ink)]">
              {drawerSource.snippet}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => setDrawerSource(null)}
            >
              Đóng
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
