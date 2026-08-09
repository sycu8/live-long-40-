-- Blog enrichment: official source citations + AI cover image metadata.
ALTER TABLE blog_posts ADD COLUMN sources_json TEXT;
ALTER TABLE blog_posts ADD COLUMN cover_image_key TEXT;
ALTER TABLE blog_posts ADD COLUMN cover_alt TEXT;
