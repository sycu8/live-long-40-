/** Motivational / advisory blog cadence & crawl schedule defaults. */

/** Calendar day step for the schedule loop (UTC). */
export const BLOG_CADENCE_DAYS = 1;

/** Minimum published/scheduled posts per calendar day. */
export const BLOG_POSTS_PER_DAY = 2;

/** How many future days the daily cron should keep pre-scheduled. */
export const BLOG_SCHEDULE_HORIZON_DAYS = 21;

/** Minimum word count for advisory blog bodies (Vietnamese whitespace tokens). */
export const BLOG_MIN_WORDS = 300;

/** Blog index page size (fast load). */
export const BLOG_PAGE_SIZE_DEFAULT = 8;
export const BLOG_PAGE_SIZE_MIN = 6;
export const BLOG_PAGE_SIZE_MAX = 9;

/** Max featured / hot posts shown in the hero block on page 1. */
export const BLOG_FEATURED_LIMIT = 3;

export const BLOG_AUTHOR_DEFAULT = "Biên tập VivaAge";

export function clampBlogPageSize(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return BLOG_PAGE_SIZE_DEFAULT;
  return Math.min(
    BLOG_PAGE_SIZE_MAX,
    Math.max(BLOG_PAGE_SIZE_MIN, Math.round(n)),
  );
}

export function clampBlogPage(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** Fallback public origin when PUBLIC_SITE_URL is unset. */
export const DEFAULT_PUBLIC_SITE_URL =
  "https://song-an-40.sycu-lee.workers.dev";

export const BLOG_THEMES = [
  "tinh-than",
  "thoi-quen",
  "suc-khoe",
  "tai-chinh",
  "cham-soc",
] as const;

export type BlogTheme = (typeof BLOG_THEMES)[number];

/** Count whitespace-separated tokens (good enough for Vietnamese word floor). */
export function countBlogWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0).length;
}
