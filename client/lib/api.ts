type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  stream?: boolean;
};

let csrfToken: string | null = null;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function getCsrfToken(): string | null {
  return csrfToken ?? readCookie("sa_csrf");
}

export async function ensureSession(): Promise<{ csrfToken: string }> {
  const res = await fetch("/api/v1/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Không tạo được phiên làm việc.");
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return data;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const csrf = getCsrfToken();
  if (csrf && options.method && options.method !== "GET") {
    headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  if (options.stream) {
    return res as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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
