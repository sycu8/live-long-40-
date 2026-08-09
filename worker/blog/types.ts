import type { BlogTheme } from "@shared/constants/blog";

export type BlogEditorialPost = {
  slug: string;
  title: string;
  excerpt: string;
  theme: BlogTheme | string;
  minutes: number;
  body: string;
  /** Official registry ids from shared/content/official-sources.ts */
  sourceIds?: string[];
  coverAlt?: string;
  coverImageKey?: string | null;
};

export type BlogDailyJobResult = {
  published: number;
  scheduled: number;
  aiGenerated: number;
  skipped: number;
};
