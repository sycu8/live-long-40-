import {
  BLOG_CADENCE_DAYS,
  BLOG_POSTS_PER_DAY,
  BLOG_SCHEDULE_HORIZON_DAYS,
} from "@shared/constants/blog";
import { defaultSourceIdsForTheme } from "@shared/content/blog-theme-sources";
import type { Env } from "../env";
import bankJson from "@shared/content/blog-editorial-bank.json" with { type: "json" };
import {
  generateEditorialPostWithAi,
  insertScheduledPost,
} from "./generate-ai";
import { generateAndStoreBlogCover } from "./images";
import type { BlogDailyJobResult, BlogEditorialPost } from "./types";

const EDITORIAL_BANK = bankJson as BlogEditorialPost[];

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateString(d);
}

/** Publish scheduled posts whose scheduled_for date has arrived. */
export async function publishDueBlogPosts(db: D1Database): Promise<number> {
  const today = utcDateString(new Date());
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE blog_posts
       SET status = 'published', published_at = ?, updated_at = ?
       WHERE status = 'scheduled' AND scheduled_for <= ?`,
    )
    .bind(now, now, today)
    .run();
  return result.meta?.changes ?? 0;
}

async function existingSlugs(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare(`SELECT slug FROM blog_posts`)
    .all<{ slug: string }>();
  return new Set((rows.results ?? []).map((r) => r.slug));
}

async function postCountByDate(db: D1Database): Promise<Map<string, number>> {
  const rows = await db
    .prepare(
      `SELECT substr(scheduled_for, 1, 10) AS d, COUNT(*) AS c FROM blog_posts
       WHERE status IN ('scheduled', 'published')
       GROUP BY substr(scheduled_for, 1, 10)`,
    )
    .all<{ d: string; c: number }>();
  const map = new Map<string, number>();
  for (const row of rows.results ?? []) {
    map.set(row.d.slice(0, 10), Number(row.c) || 0);
  }
  return map;
}

function nextBankPost(
  used: Set<string>,
  cursor: { index: number },
): BlogEditorialPost | null {
  for (let i = 0; i < EDITORIAL_BANK.length; i++) {
    const idx = (cursor.index + i) % EDITORIAL_BANK.length;
    const post = EDITORIAL_BANK[idx]!;
    if (!used.has(post.slug)) {
      cursor.index = idx + 1;
      return {
        ...post,
        sourceIds:
          post.sourceIds?.length
            ? post.sourceIds
            : defaultSourceIdsForTheme(String(post.theme)),
      };
    }
  }
  return null;
}

/**
 * Ensure at least BLOG_POSTS_PER_DAY posts exist for each day in the horizon.
 * Prefers unused editorial-bank drafts; falls back to Workers AI (+ cover image).
 */
export async function ensureDailyBlogSchedule(
  env: Env,
  options?: { horizonDays?: number; today?: string },
): Promise<Omit<BlogDailyJobResult, "published">> {
  const horizon = options?.horizonDays ?? BLOG_SCHEDULE_HORIZON_DAYS;
  const today = options?.today ?? utcDateString(new Date());
  const counts = await postCountByDate(env.DB);
  const usedSlugs = await existingSlugs(env.DB);
  const cursor = { index: 0 };

  let scheduled = 0;
  let aiGenerated = 0;
  let skipped = 0;

  for (let offset = 0; offset <= horizon; offset += BLOG_CADENCE_DAYS) {
    const day = addUtcDays(today, offset);
    let have = counts.get(day) ?? 0;

    while (have < BLOG_POSTS_PER_DAY) {
      const slot = have;
      let post = nextBankPost(usedSlugs, cursor);
      let fromAi = false;
      if (!post) {
        post = await generateEditorialPostWithAi(env, day, slot);
        fromAi = Boolean(post);
        if (post && usedSlugs.has(post.slug)) {
          post = {
            ...post,
            slug: `${post.slug}-${createShortSuffix()}`,
          };
        }
      } else if (!post.coverImageKey && env.AI && env.SOURCES) {
        const cover = await generateAndStoreBlogCover(
          env,
          post.slug,
          post.title,
          String(post.theme),
        );
        if (cover) {
          post = {
            ...post,
            coverImageKey: cover.key,
            coverAlt: cover.alt,
          };
        }
      }

      if (!post) {
        skipped += 1;
        break;
      }

      const status = day <= today ? "published" : "scheduled";
      const ok = await insertScheduledPost(env.DB, post, day, status);
      if (ok) {
        usedSlugs.add(post.slug);
        have += 1;
        counts.set(day, have);
        scheduled += 1;
        if (fromAi) aiGenerated += 1;
      } else {
        skipped += 1;
        break;
      }
    }
  }

  return { scheduled, aiGenerated, skipped };
}

function createShortSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

/** Daily cron entry: publish due posts, then fill the schedule horizon. */
export async function runBlogDailyJob(env: Env): Promise<BlogDailyJobResult> {
  const published = await publishDueBlogPosts(env.DB);
  const rest = await ensureDailyBlogSchedule(env);
  return { published, ...rest };
}

export function editorialBankSize(): number {
  return EDITORIAL_BANK.length;
}
