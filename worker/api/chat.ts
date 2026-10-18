import { Hono } from "hono";
import {
  CreateChatSessionSchema,
  ChatMessageSchema,
  FeedbackSchema,
} from "@shared/schemas/api";
import { createId, nowIso } from "@shared/utils/id";
import type { Env, AppVariables } from "../env";
import { jsonError } from "../lib/errors";
import { enforceRateLimit } from "../middleware/security";
import { runChatPipeline, SYSTEM_PROMPT_VERSION } from "../ai/pipeline";

export const chatRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

chatRoutes.post("/chat/sessions", async (c) => {
  const body = CreateChatSessionSchema.parse(await c.req.json().catch(() => ({})));
  const id = createId("cs");
  const publicId = createId("pcs");
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO chat_sessions (id, public_id, session_id, title, history_opt_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      publicId,
      c.get("sessionId"),
      body.title ?? "Hỏi VivaAge",
      body.historyOptIn ? 1 : 0,
      now,
      now,
    )
    .run();

  if (body.historyOptIn) {
    await c.env.DB.prepare(
      `INSERT INTO consent_events (id, session_id, consent_type, granted, created_at)
       VALUES (?, ?, 'chat_history', 1, ?)`,
    )
      .bind(createId("consent"), c.get("sessionId"), now)
      .run();
  }

  return c.json({ chatSessionPublicId: publicId, historyOptIn: body.historyOptIn });
});

/** Resume latest opted-in chat for this anonymous session (privacy: only when history_opt_in). */
chatRoutes.get("/chat/sessions/latest", async (c) => {
  const chat = await c.env.DB.prepare(
    `SELECT id, public_id, history_opt_in, title, updated_at
     FROM chat_sessions
     WHERE session_id = ? AND history_opt_in = 1
     ORDER BY updated_at DESC
     LIMIT 1`,
  )
    .bind(c.get("sessionId"))
    .first<{
      id: string;
      public_id: string;
      history_opt_in: number;
      title: string;
      updated_at: string;
    }>();

  if (!chat) {
    return c.json({ chatSessionPublicId: null, historyOptIn: true, messages: [] });
  }

  const rows = await c.env.DB.prepare(
    `SELECT public_id, role, content, classification, abstained, created_at
     FROM chat_messages
     WHERE chat_session_id = ? AND content IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 40`,
  )
    .bind(chat.id)
    .all();

  return c.json({
    chatSessionPublicId: chat.public_id,
    historyOptIn: true,
    title: chat.title,
    updatedAt: chat.updated_at,
    messages: (rows.results ?? []).map((m) => ({
      id: m.public_id,
      role: m.role,
      content: m.content,
      kind: m.abstained ? "abstain" : undefined,
      classification: m.classification,
      createdAt: m.created_at,
    })),
  });
});

chatRoutes.post("/chat/sessions/:id/messages", async (c) => {
  const ok = await enforceRateLimit(c, "chat", 30, 3600);
  if (!ok) {
    return jsonError(
      c,
      429,
      "RATE_LIMITED",
      "Bạn đã gửi quá nhiều câu hỏi. Thử lại sau.",
    );
  }

  const chatPublicId = c.req.param("id");
  const body = ChatMessageSchema.parse(await c.req.json());

  // Turnstile check when secret configured
  if (c.env.TURNSTILE_SECRET_KEY) {
    if (!body.turnstileToken) {
      return jsonError(c, 403, "TURNSTILE_FAILED", "Thiếu xác minh chống bot.");
    }
    const form = new FormData();
    form.set("secret", c.env.TURNSTILE_SECRET_KEY);
    form.set("response", body.turnstileToken);
    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const verifyJson = (await verify.json()) as { success?: boolean };
    if (!verifyJson.success) {
      return jsonError(c, 403, "TURNSTILE_FAILED", "Xác minh chống bot thất bại.");
    }
  }

  const chat = await c.env.DB.prepare(
    `SELECT id, session_id, history_opt_in FROM chat_sessions WHERE public_id = ?`,
  )
    .bind(chatPublicId)
    .first<{ id: string; session_id: string; history_opt_in: number }>();

  if (!chat) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy phiên chat.");
  if (chat.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Bạn không có quyền với phiên chat này.");
  }

  const userMsgId = createId("msg");
  const userPublicId = createId("pmsg");
  const storeUserContent = chat.history_opt_in ? body.content : null;

  await c.env.DB.prepare(
    `INSERT INTO chat_messages
     (id, public_id, chat_session_id, role, content, content_redacted, created_at)
     VALUES (?, ?, ?, 'user', ?, ?, ?)`,
  )
    .bind(
      userMsgId,
      userPublicId,
      chat.id,
      storeUserContent,
      chat.history_opt_in ? 0 : 1,
      nowIso(),
    )
    .run();

  const assistantMsgId = createId("msg");
  const assistantPublicId = createId("pmsg");
  const pipeline = await runChatPipeline(c.env, body.content);

  if (pipeline.kind === "high_risk") {
    await c.env.DB.prepare(
      `INSERT INTO chat_messages
       (id, public_id, chat_session_id, role, content, content_redacted, classification, risk_class, prompt_version, abstained, created_at)
       VALUES (?, ?, ?, 'assistant', ?, 1, ?, ?, ?, 0, ?)`,
    )
      .bind(
        assistantMsgId,
        assistantPublicId,
        chat.id,
        null,
        pipeline.classification,
        pipeline.riskClass,
        SYSTEM_PROMPT_VERSION,
        nowIso(),
      )
      .run();

    // Privacy-safe analytics event (no question text)
    try {
      await c.env.ANALYTICS_QUEUE?.send({
        type: "risk_routed",
        riskClass: pipeline.riskClass,
        at: nowIso(),
      });
    } catch {
      /* optional binding */
    }

    // Same SSE path as a normal answer (#43 appends every token). The 115
    // text is already decided, so this does not wait on cache, retrieval, or the model.
    const encoder = new TextEncoder();
    const parts = pipeline.message.split(/\n\n/);
    const stream = new ReadableStream({
      start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        send({
          type: "meta",
          classification: pipeline.classification,
          riskClass: pipeline.riskClass,
          messagePublicId: assistantPublicId,
        });
        parts.forEach((part, index) => {
          if (!part) return;
          send({ type: "token", text: index === 0 ? part : `\n\n${part}` });
        });
        send({ type: "done", abstained: false });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  }

  if (pipeline.kind === "abstain") {
    if (!pipeline.followUp) {
      await c.env.DB.prepare(
        `INSERT INTO chat_messages
         (id, public_id, chat_session_id, role, content, content_redacted, classification, risk_class, prompt_version, abstained, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, 'none', ?, 1, ?)`,
      )
        .bind(
          assistantMsgId,
          assistantPublicId,
          chat.id,
          chat.history_opt_in ? pipeline.message : null,
          chat.history_opt_in ? 0 : 1,
          pipeline.classification,
          SYSTEM_PROMPT_VERSION,
          nowIso(),
        )
        .run();

      return c.json({
        messagePublicId: assistantPublicId,
        kind: "abstain",
        content: pipeline.message,
        sources: pipeline.sources,
        classification: pipeline.classification,
      });
    }

    // The refusal is the first token. A late alert is more tokens, not a dropped block.
    const encoder = new TextEncoder();
    const opening = pipeline.message;
    const followUp = pipeline.followUp;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        send({
          type: "meta",
          classification: pipeline.classification,
          riskClass: "none",
          messagePublicId: assistantPublicId,
        });
        send({ type: "token", text: opening });
        let extra = "";
        try {
          extra = await followUp;
        } catch {
          extra = "";
        }
        if (extra) send({ type: "token", text: extra });
        const full = `${opening}${extra}`;
        try {
          await c.env.DB.prepare(
            `INSERT INTO chat_messages
             (id, public_id, chat_session_id, role, content, content_redacted, classification, risk_class, prompt_version, abstained, created_at)
             VALUES (?, ?, ?, 'assistant', ?, ?, ?, 'none', ?, 1, ?)`,
          )
            .bind(
              assistantMsgId,
              assistantPublicId,
              chat.id,
              chat.history_opt_in ? full : null,
              chat.history_opt_in ? 0 : 1,
              pipeline.classification,
              SYSTEM_PROMPT_VERSION,
              nowIso(),
            )
            .run();
        } catch {
          /* the tokens were already sent */
        }
        send({ type: "done", abstained: true });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  }

  // Streaming answer (SSE)
  const encoder = new TextEncoder();
  const sources = pipeline.sources;
  const mode = pipeline.mode;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      send({
        type: "meta",
        classification: pipeline.classification,
        riskClass: "none",
        messagePublicId: assistantPublicId,
        retrievalMode: mode,
      });
      send({
        type: "sources",
        sources: sources.map((s) => ({
          key: s.key,
          title: s.title,
          issuer: s.issuer,
          date: s.publicationDate,
          url: s.url,
          snippet: s.snippet,
        })),
      });

      const reader = pipeline.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          send({ type: "token", text: value });
        }
        const full = await pipeline.fullTextPromise;
        await c.env.DB.prepare(
          `INSERT INTO chat_messages
           (id, public_id, chat_session_id, role, content, content_redacted, classification, risk_class, prompt_version, abstained, created_at)
           VALUES (?, ?, ?, 'assistant', ?, ?, ?, 'none', ?, 0, ?)`,
        )
          .bind(
            assistantMsgId,
            assistantPublicId,
            chat.id,
            chat.history_opt_in ? full : null,
            chat.history_opt_in ? 0 : 1,
            pipeline.classification,
            SYSTEM_PROMPT_VERSION,
            nowIso(),
          )
          .run();

        for (const s of sources) {
          const realSourceId =
            s.sourceId &&
            !s.sourceId.startsWith("bank:") &&
            !s.sourceId.startsWith("lesson:") &&
            !s.sourceId.startsWith("official:")
              ? s.sourceId
              : null;
          const realChunkId =
            s.chunkId &&
            !s.chunkId.startsWith("bank:") &&
            !s.chunkId.startsWith("lesson:") &&
            !s.chunkId.startsWith("official:")
              ? s.chunkId
              : null;
          await c.env.DB.prepare(
            `INSERT INTO chat_citations
             (id, message_id, source_id, chunk_id, citation_key, title, issuer, publication_date, url, snippet, score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              createId("cite"),
              assistantMsgId,
              realSourceId,
              realChunkId,
              s.key,
              s.title,
              s.issuer,
              s.publicationDate ?? null,
              s.url ?? null,
              s.snippet,
              s.score,
            )
            .run();
        }

        await c.env.DB.prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`)
          .bind(nowIso(), chat.id)
          .run();

        send({ type: "done", abstained: false });
      } catch {
        send({
          type: "error",
          code: "INTERNAL_ERROR",
          message: "Luồng trả lời bị gián đoạn. Vui lòng thử lại.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
});

chatRoutes.get("/chat/messages/:id/sources", async (c) => {
  const messagePublicId = c.req.param("id");
  const msg = await c.env.DB.prepare(
    `SELECT m.id, cs.session_id
     FROM chat_messages m
     JOIN chat_sessions cs ON cs.id = m.chat_session_id
     WHERE m.public_id = ?`,
  )
    .bind(messagePublicId)
    .first<{ id: string; session_id: string }>();

  if (!msg) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy tin nhắn.");
  if (msg.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Bạn không có quyền xem nguồn này.");
  }

  const cites = await c.env.DB.prepare(
    `SELECT citation_key, title, issuer, publication_date, url, snippet, score
     FROM chat_citations WHERE message_id = ?`,
  )
    .bind(msg.id)
    .all();

  return c.json({
    sources: (cites.results ?? []).map((s) => ({
      key: s.citation_key,
      title: s.title,
      issuer: s.issuer,
      date: s.publication_date,
      url: s.url,
      snippet: s.snippet,
      score: s.score,
    })),
  });
});

chatRoutes.post("/feedback/ai-answer", async (c) => {
  const ok = await enforceRateLimit(c, "feedback", 40, 3600);
  if (!ok) return jsonError(c, 429, "RATE_LIMITED", "Quá nhiều phản hồi.");

  const body = FeedbackSchema.parse(await c.req.json());
  const msg = await c.env.DB.prepare(
    `SELECT m.id, cs.session_id
     FROM chat_messages m
     JOIN chat_sessions cs ON cs.id = m.chat_session_id
     WHERE m.public_id = ?`,
  )
    .bind(body.messagePublicId)
    .first<{ id: string; session_id: string }>();

  if (!msg) return jsonError(c, 404, "NOT_FOUND", "Không tìm thấy câu trả lời.");
  if (msg.session_id !== c.get("sessionId")) {
    return jsonError(c, 403, "FORBIDDEN", "Không có quyền.");
  }

  await c.env.DB.prepare(
    `INSERT INTO user_feedback (id, session_id, target_type, target_id, rating, helpful, comment_redacted, created_at)
     VALUES (?, ?, 'ai_answer', ?, ?, ?, ?, ?)`,
  )
    .bind(
      createId("fb"),
      c.get("sessionId"),
      msg.id,
      body.rating ?? null,
      body.helpful ? 1 : 0,
      body.comment ? "[redacted-length:" + body.comment.length + "]" : null,
      nowIso(),
    )
    .run();

  return c.json({ saved: true });
});
