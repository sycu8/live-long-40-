/** Motivational blog cadence & crawl schedule defaults. */

/** One new published post per calendar day (UTC). */
export const BLOG_CADENCE_DAYS = 1;

/** How many future days the daily cron should keep pre-scheduled. */
export const BLOG_SCHEDULE_HORIZON_DAYS = 21;

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
