import type { BlogTheme } from "@shared/constants/blog";

export type BlogEditorialPost = {
  slug: string;
  title: string;
  excerpt: string;
  theme: BlogTheme | string;
  minutes: number;
  body: string;
};

export type BlogDailyJobResult = {
  published: number;
  scheduled: number;
  aiGenerated: number;
  skipped: number;
};
