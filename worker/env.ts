export type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  SOURCES: R2Bucket;
  CONFIG: KVNamespace;
  AI: Ai;
  AI_SEARCH: {
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
  INGESTION_QUEUE: Queue;
  ANALYTICS_QUEUE: Queue;
  INGESTION_WORKFLOW: Workflow;
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
  /** Secrets via `wrangler secret put` — never commit values */
  SESSION_SIGNING_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_SHARED_SECRET?: string;
};

export type AppVariables = {
  sessionId: string;
  sessionPublicId: string;
  csrfToken: string;
  requestId: string;
};
