// Generated placeholder — refresh with `pnpm cf:types` after wrangler config changes.
interface CloudflareEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  SOURCES: R2Bucket;
  CONFIG: KVNamespace;
  AI: Ai;
  AI_SEARCH: any;
  INGESTION_QUEUE: Queue;
  ANALYTICS_QUEUE: Queue;
  INGESTION_WORKFLOW: Workflow;
  ENVIRONMENT: string;
  APP_NAME: string;
  AI_SEARCH_INSTANCE: string;
  SESSION_COOKIE_NAME: string;
  CSRF_COOKIE_NAME: string;
  TURNSTILE_SITE_KEY: string;
  FEATURE_CHAT_HISTORY_DEFAULT: string;
  PROMPT_VERSION: string;
  SCORING_RULESET_VERSION: string;
  SAFETY_RULESET_VERSION: string;
  PLAN_RULESET_VERSION: string;
  SESSION_SIGNING_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_SHARED_SECRET?: string;
}
