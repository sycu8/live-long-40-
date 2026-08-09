-- Featured / hot posts for blog listing hero layout.
ALTER TABLE blog_posts ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN featured_rank INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON blog_posts (status, is_featured, featured_rank, published_at);
