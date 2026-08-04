import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorCode } from "@shared/schemas/api";
import type { AppVariables, Env } from "../env";

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export function jsonError(
  c: AppContext,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  return c.json(
    {
      error: {
        code,
        message,
        details,
        requestId: c.get("requestId"),
      },
    },
    status,
  );
}
