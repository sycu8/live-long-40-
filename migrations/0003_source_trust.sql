-- Trust tier for source_documents: official VN / international guideline / editorial
ALTER TABLE source_documents ADD COLUMN trust_tier TEXT NOT NULL DEFAULT 'editorial';

CREATE INDEX IF NOT EXISTS idx_source_documents_trust
  ON source_documents(trust_tier, status, review_status);
