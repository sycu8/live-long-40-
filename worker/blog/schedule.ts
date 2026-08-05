import {
  BLOG_CADENCE_DAYS,
  BLOG_SCHEDULE_HORIZON_DAYS,
} from "@shared/constants/blog";
import { nowIso } from "@shared/utils/id";
import type { Env } from "../env";
import bankJson from "@shared/content/blog-editorial-bank.json" with { type: "json" };
import {
  generateEditorialPostWithAi,
  insertScheduledPost,
} from "./generate-ai";
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
  const now = nowIso();
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

async function datesWithPosts(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare(
      `SELECT scheduled_for AS d FROM blog_posts
       WHERE status IN ('scheduled', 'published')`,
    )
    .all<{ d: string }>();
  return new Set((rows.results ?? []).map((r) => r.d.slice(0, 10)));
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
      return post;
    }
  }
  return null;
}

/**
 * Ensure one blog post is scheduled (or published) for each day in the horizon.
 * Prefers unused editorial-bank drafts; falls back to Workers AI when the bank is exhausted.
 */
export async function ensureDailyBlogSchedule(
  env: Env,
  options?: { horizonDays?: number; today?: string },
): Promise<Omit<BlogDailyJobResult, "published">> {
  const horizon = options?.horizonDays ?? BLOG_SCHEDULE_HORIZON_DAYS;
  const today = options?.today ?? utcDateString(new Date());
  const occupied = await datesWithPosts(env.DB);
  const usedSlugs = await existingSlugs(env.DB);
  const cursor = { index: 0 };

  let scheduled = 0;
  let aiGenerated = 0;
  let skipped = 0;

  for (let offset = 0; offset <= horizon; offset += BLOG_CADENCE_DAYS) {
    const day = addUtcDays(today, offset);
    if (occupied.has(day)) {
      skipped += 1;
      continue;
    }

    let post = nextBankPost(usedSlugs, cursor);
    let fromAi = false;
    if (!post) {
      post = await generateEditorialPostWithAi(env, day);
      fromAi = Boolean(post);
      if (post && usedSlugs.has(post.slug)) {
        post = {
          ...post,
          slug: `${post.slug}-${createShortSuffix()}`,
        };
      }
    }
    if (!post) {
      skipped += 1;
      continue;
    }

    const status = day <= today ? "published" : "scheduled";
    const ok = await insertScheduledPost(env.DB, post, day, status);
    if (ok) {
      usedSlugs.add(post.slug);
      occupied.add(day);
      scheduled += 1;
      if (fromAi) aiGenerated += 1;
    } else {
      skipped += 1;
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
