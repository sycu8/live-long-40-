/** Motivational / advisory blog cadence & crawl schedule defaults. */

/** Calendar day step for the schedule loop (UTC). */
export const BLOG_CADENCE_DAYS = 1;

/** Minimum published/scheduled posts per calendar day. */
export const BLOG_POSTS_PER_DAY = 2;

/** How many future days the daily cron should keep pre-scheduled. */
export const BLOG_SCHEDULE_HORIZON_DAYS = 21;

/** Minimum word count for advisory blog bodies (Vietnamese whitespace tokens). */
export const BLOG_MIN_WORDS = 300;

export const BLOG_AUTHOR_DEFAULT = "Biên tập VivaAge";

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
