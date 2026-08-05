export type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  /** Optional on temporary preview accounts (R2 not always available). */
  SOURCES?: R2Bucket;
  CONFIG: KVNamespace;
  AI?: Ai;
  AI_SEARCH?: {
    get(id: string): {
      search(input: {
        query?: string;
        messages?: Array<{ role: string; content: string }>;
      }): Promise<{
        data?: Array<{
          score?: number;
          content?: string;
          filename?: string;
          id?: string;
          metadata?: Record<string, unknown>;
        }>;
        response?: string;
      }>;
      items: {
        upload(
          name: string,
          content: string | ArrayBuffer | ReadableStream,
          options?: { metadata?: Record<string, string> },
        ): Promise<{ id: string }>;
        uploadAndPoll?(
          name: string,
          content: string | ArrayBuffer,
          options?: { metadata?: Record<string, string> },
        ): Promise<{ id: string }>;
        delete?(id: string): Promise<void>;
      };
    };
    create?(opts: { id: string }): Promise<unknown>;
  };
  INGESTION_QUEUE?: Queue;
  ANALYTICS_QUEUE?: Queue;
  /** Optional when Workflows are unavailable (e.g. temporary preview accounts). */
  INGESTION_WORKFLOW?: Workflow;
  ENVIRONMENT: string;
  APP_NAME: string;
  AI_SEARCH_INSTANCE: string;
  AI_GATEWAY_ID: string;
  SESSION_COOKIE_NAME: string;
  CSRF_COOKIE_NAME: string;
  TURNSTILE_SITE_KEY: string;
  FEATURE_CHAT_HISTORY_DEFAULT: string;
  PROMPT_VERSION: string;
  SCORING_RULESET_VERSION: string;
  SAFETY_RULESET_VERSION: string;
  PLAN_RULESET_VERSION: string;
  /** Public canonical origin for sitemap/robots/feed (no trailing slash). */
  PUBLIC_SITE_URL?: string;
  /** Secrets via `wrangler secret put` — never commit values */
  SESSION_SIGNING_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_SHARED_SECRET?: string;
  LOCAL_QA_ADMIN_TOKEN?: string;
};

export type AppVariables = {
  sessionId: string;
  sessionPublicId: string;
  csrfToken: string;
  requestId: string;
};
