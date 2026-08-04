-- Motivational blog for Sống An 40+
-- Posts can be scheduled; a cron publishes due items every day (content cadence: ~2 days).

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  theme TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL,
  body_markdown TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  scheduled_for TEXT NOT NULL,
  published_at TEXT,
  author_name TEXT NOT NULL DEFAULT 'Biên tập Sống An',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_sched
  ON blog_posts (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON blog_posts (status, published_at);
