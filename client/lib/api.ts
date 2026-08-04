type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: boolean;
};

let csrfToken: string | null = null;
let adminBearer: string | null = null;
let sessionBootstrap: Promise<{ csrfToken: string }> | null = null;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function getCsrfToken(): string | null {
  return csrfToken ?? readCookie("sa_csrf");
}

/** In-memory only — never persisted to localStorage. */
export function setAdminBearer(token: string | null) {
  adminBearer = token && token.trim() ? token.trim() : null;
}

export function getAdminBearer(): string | null {
  return adminBearer;
}

export async function ensureSession(): Promise<{ csrfToken: string }> {
  if (csrfToken) return { csrfToken };
  const fromCookie = readCookie("sa_csrf");
  if (fromCookie && readCookie("sa_session") === null) {
    // CSRF cookie without session is incomplete — continue bootstrap
  }
  if (!sessionBootstrap) {
    sessionBootstrap = (async () => {
      const res = await fetch("/api/v1/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "same-origin",
      });
      if (!res.ok) {
        sessionBootstrap = null;
        throw new Error("Không tạo được phiên làm việc.");
      }
      const data = (await res.json()) as { csrfToken: string };
      csrfToken = data.csrfToken;
      return data;
    })();
  }
  return sessionBootstrap;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (!csrfToken) {
    await ensureSession();
  }
  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const csrf = getCsrfToken();
  if (csrf && method !== "GET" && method !== "HEAD" && !headers["X-CSRF-Token"]) {
    headers["X-CSRF-Token"] = csrf;
  }
  if (adminBearer && path.startsWith("/admin") && !headers.Authorization) {
    headers.Authorization = `Bearer ${adminBearer}`;
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  if (options.stream) {
    return res as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Recover once from CSRF desync (e.g. stale tab state)
    if (
      (data as { error?: { code?: string } })?.error?.code === "CSRF_FAILED" &&
      method !== "GET"
    ) {
      csrfToken = null;
      sessionBootstrap = null;
      await ensureSession();
      const retryHeaders = { ...headers, "X-CSRF-Token": getCsrfToken() ?? "" };
      const retry = await fetch(`/api/v1${path}`, {
        method,
        headers: retryHeaders,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: "same-origin",
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) {
        const message =
          (retryData as { error?: { message?: string } })?.error?.message ??
          "Yêu cầu thất bại.";
        const err = new Error(message) as Error & { status?: number; code?: string };
        err.status = retry.status;
        err.code = (retryData as { error?: { code?: string } })?.error?.code;
        throw err;
      }
      return retryData as T;
    }

    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      "Yêu cầu thất bại.";
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (data as { error?: { code?: string } })?.error?.code;
    throw err;
  }
  return data as T;
}
