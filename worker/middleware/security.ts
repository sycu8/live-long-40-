import { createMiddleware } from "hono/factory";
import type { Env, AppVariables } from "../env";
import { createId, nowIso, addDaysIso, timingSafeEqualString } from "@shared/utils/id";
import { jsonError } from "../lib/errors";

const MAX_BODY = 512_000;

export const requestContext = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  c.set("requestId", createId("req"));
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > MAX_BODY) {
    return jsonError(c, 413, "PAYLOAD_TOO_LARGE", "Nội dung yêu cầu quá lớn.");
  }
  await next();
});

export const securityHeaders = createMiddleware(async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  const path = new URL(c.req.url).pathname;
  const isHashedAsset = path.startsWith("/assets/");
  const isPublicDiscovery =
    path === "/" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/feed.xml" ||
    path === "/auth.md" ||
    path === "/openapi.json" ||
    path === "/llms.txt" ||
    path === "/llms-full.txt" ||
    path === "/mcp" ||
    path.startsWith("/mcp/") ||
    path.startsWith("/.well-known/");
  if (isHashedAsset) {
    c.res.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else if (!isPublicDiscovery) {
    c.res.headers.set("Cache-Control", "no-store");
  }
});

async function ensureSession(c: Parameters<typeof requestContext>[0]) {
  const cookieName = c.env.SESSION_COOKIE_NAME || "sa_session";
  const csrfName = c.env.CSRF_COOKIE_NAME || "sa_csrf";
  const existing = getCookie(c.req.raw.headers.get("Cookie"), cookieName);

  if (existing) {
    const row = await c.env.DB.prepare(
      `SELECT id, public_id, expires_at FROM anonymous_sessions WHERE id = ?`,
    )
      .bind(existing)
      .first<{ id: string; public_id: string; expires_at: string }>();
    if (row && row.expires_at > nowIso()) {
      await c.env.DB.prepare(
        `UPDATE anonymous_sessions SET last_seen_at = ? WHERE id = ?`,
      )
        .bind(nowIso(), row.id)
        .run();
      c.set("sessionId", row.id);
      c.set("sessionPublicId", row.public_id);
      let csrf = getCookie(c.req.raw.headers.get("Cookie"), csrfName);
      if (!csrf) {
        csrf = createId("csrf");
        setCookie(c, csrfName, csrf, { httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
      }
      c.set("csrfToken", csrf);
      return;
    }
  }

  const id = createId("sess");
  const publicId = createId("ps");
  const now = nowIso();
  const expires = addDaysIso(30);
  await c.env.DB.prepare(
    `INSERT INTO anonymous_sessions (id, public_id, created_at, last_seen_at, expires_at, retention_category)
     VALUES (?, ?, ?, ?, ?, 'operational')`,
  )
    .bind(id, publicId, now, now, expires)
    .run();

  setCookie(c, cookieName, id, { httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  const csrf = createId("csrf");
  setCookie(c, csrfName, csrf, { httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
  c.set("sessionId", id);
  c.set("sessionPublicId", publicId);
  c.set("csrfToken", csrf);
}

export const anonymousSession = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  if (!c.env.DB) {
    return jsonError(
      c,
      503,
      "BINDING_MISSING",
      "Cơ sở dữ liệu D1 chưa được cấu hình.",
    );
  }
  await ensureSession(c);
  await next();
});

export const csrfProtection = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    await next();
    return;
  }
  // Bootstrap: first anonymous session create may not yet have a client-side CSRF header.
  const path = new URL(c.req.url).pathname;
  if (path === "/api/v1/session" && c.req.method === "POST") {
    await next();
    return;
  }
  const header = c.req.header("X-CSRF-Token") ?? "";
  const token = c.get("csrfToken") ?? "";
  if (!token || !header || !timingSafeEqualString(header, token)) {
    return jsonError(c, 403, "CSRF_FAILED", "CSRF token không hợp lệ.");
  }
  await next();
});

export const requireAdmin = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  // Cloudflare Access JWT is expected in production (Cf-Access-Jwt-Assertion).
  // Local/staging can use Authorization: Bearer with ADMIN_SHARED_SECRET or LOCAL_QA_ADMIN_TOKEN.
  const accessJwt = c.req.header("Cf-Access-Jwt-Assertion");
  if (accessJwt) {
    await next();
    return;
  }

  const auth = c.req.header("Authorization") ?? "";
  const secrets = [c.env.ADMIN_SHARED_SECRET, c.env.LOCAL_QA_ADMIN_TOKEN].filter(
    (s): s is string => Boolean(s && s.length > 0),
  );

  for (const secret of secrets) {
    if (auth === `Bearer ${secret}`) {
      await next();
      return;
    }
  }

  // Open only when explicitly in development AND no local admin token configured.
  if (c.env.ENVIRONMENT === "development" && secrets.length === 0) {
    await next();
    return;
  }

  return jsonError(
    c,
    401,
    "UNAUTHORIZED",
    "Khu vực quản trị yêu cầu Cloudflare Access hoặc token quản trị.",
  );
});

export async function enforceRateLimit(
  c: Parameters<typeof requestContext>[0],
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `${bucket}:${c.get("sessionId")}`;
  const now = Date.now();
  const row = await c.env.DB.prepare(
    `SELECT count, window_start FROM rate_limit_buckets WHERE bucket_key = ?`,
  )
    .bind(key)
    .first<{ count: number; window_start: string }>();

  if (!row) {
    await c.env.DB.prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, count, window_start) VALUES (?, 1, ?)`,
    )
      .bind(key, new Date(now).toISOString())
      .run();
    return true;
  }

  const windowStart = Date.parse(row.window_start);
  if (now - windowStart > windowSeconds * 1000) {
    await c.env.DB.prepare(
      `UPDATE rate_limit_buckets SET count = 1, window_start = ? WHERE bucket_key = ?`,
    )
      .bind(new Date(now).toISOString(), key)
      .run();
    return true;
  }

  if (row.count >= limit) return false;

  await c.env.DB.prepare(
    `UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ?`,
  )
    .bind(key)
    .run();
  return true;
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function setCookie(
  c: Parameters<typeof requestContext>[0],
  name: string,
  value: string,
  opts: { httpOnly: boolean; maxAge: number },
) {
  const secure = c.env.ENVIRONMENT !== "development";
  const pieces = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.httpOnly) pieces.push("HttpOnly");
  if (secure) pieces.push("Secure");
  c.header("Set-Cookie", pieces.join("; "), { append: true });
}
