-- Migration: 0001_init.sql
-- Sống An 40+ core schema

PRAGMA foreign_keys = ON;

CREATE TABLE anonymous_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  retention_category TEXT NOT NULL DEFAULT 'operational',
  metadata_json TEXT
);

CREATE INDEX idx_anonymous_sessions_public_id ON anonymous_sessions(public_id);
CREATE INDEX idx_anonymous_sessions_expires_at ON anonymous_sessions(expires_at);

CREATE TABLE assessment_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scoring_ruleset_version TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_assessment_definitions_version ON assessment_definitions(version);

CREATE TABLE assessment_questions (
  id TEXT PRIMARY KEY NOT NULL,
  definition_id TEXT NOT NULL REFERENCES assessment_definitions(id),
  question_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  pillar TEXT NOT NULL,
  prompt TEXT NOT NULL,
  help_text TEXT,
  why_important TEXT,
  input_type TEXT NOT NULL,
  options_json TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  required INTEGER NOT NULL DEFAULT 1,
  UNIQUE(definition_id, question_key)
);

CREATE INDEX idx_assessment_questions_definition ON assessment_questions(definition_id, sort_order);

CREATE TABLE assessment_runs (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  definition_id TEXT NOT NULL REFERENCES assessment_definitions(id),
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_question_key TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  scoring_ruleset_version TEXT NOT NULL
);

CREATE INDEX idx_assessment_runs_session ON assessment_runs(session_id, started_at DESC);

CREATE TABLE assessment_answers (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES assessment_runs(id),
  question_id TEXT NOT NULL REFERENCES assessment_questions(id),
  answer_value TEXT NOT NULL,
  answered_at TEXT NOT NULL,
  UNIQUE(run_id, question_id)
);

CREATE INDEX idx_assessment_answers_run ON assessment_answers(run_id);

CREATE TABLE readiness_results (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL UNIQUE REFERENCES assessment_runs(id),
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  overall_score INTEGER NOT NULL,
  health_score INTEGER NOT NULL,
  finance_score INTEGER NOT NULL,
  caregiving_score INTEGER NOT NULL,
  interpretation_json TEXT NOT NULL,
  gaps_json TEXT NOT NULL,
  strengths_json TEXT NOT NULL,
  explainability_json TEXT NOT NULL,
  scoring_ruleset_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_readiness_results_session ON readiness_results(session_id, created_at DESC);

CREATE TABLE plan_versions (
  id TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL UNIQUE,
  ruleset_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  readiness_result_id TEXT NOT NULL REFERENCES readiness_results(id),
  plan_version_id TEXT NOT NULL REFERENCES plan_versions(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_plans_session ON plans(session_id, created_at DESC);

CREATE TABLE plan_actions (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  week_number INTEGER NOT NULL,
  action_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  effort_minutes INTEGER NOT NULL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  pillar TEXT NOT NULL,
  source_ref TEXT,
  lesson_slug TEXT,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_plan_actions_plan ON plan_actions(plan_id, week_number, sort_order);

CREATE TABLE action_completions (
  id TEXT PRIMARY KEY NOT NULL,
  action_id TEXT NOT NULL REFERENCES plan_actions(id),
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  completed_at TEXT NOT NULL,
  difficulty INTEGER,
  confidence INTEGER,
  note TEXT,
  UNIQUE(action_id, session_id)
);

CREATE TABLE source_documents (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  issuer TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'VN',
  document_type TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'vi',
  category TEXT NOT NULL,
  pillar TEXT,
  estimated_reading_minutes INTEGER,
  original_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  review_status TEXT NOT NULL DEFAULT 'pending',
  publication_date TEXT,
  effective_from TEXT,
  effective_to TEXT,
  last_reviewed_at TEXT,
  reviewer TEXT,
  r2_object_key TEXT,
  content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_source_documents_status ON source_documents(status, review_status);
CREATE INDEX idx_source_documents_category ON source_documents(category, status);
CREATE INDEX idx_source_documents_slug ON source_documents(slug);

CREATE TABLE source_versions (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES source_documents(id),
  version_number INTEGER NOT NULL,
  r2_object_key TEXT,
  content_hash TEXT,
  reviewed_text TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  UNIQUE(source_id, version_number)
);

CREATE TABLE source_chunks (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES source_documents(id),
  version_id TEXT NOT NULL REFERENCES source_versions(id),
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  location_ref TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  indexing_status TEXT NOT NULL DEFAULT 'pending',
  ai_search_item_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(version_id, chunk_index)
);

CREATE INDEX idx_source_chunks_source ON source_chunks(source_id, indexing_status);

CREATE TABLE ingestion_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL REFERENCES source_documents(id),
  version_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  workflow_instance_id TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_ingestion_jobs_source ON ingestion_jobs(source_id, created_at DESC);
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs(status);

CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  title TEXT,
  history_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_chat_sessions_session ON chat_sessions(session_id, updated_at DESC);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,
  content TEXT,
  content_redacted INTEGER NOT NULL DEFAULT 0,
  classification TEXT,
  risk_class TEXT,
  prompt_version TEXT,
  abstained INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_chat_messages_session ON chat_messages(chat_session_id, created_at);

CREATE TABLE chat_citations (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES chat_messages(id),
  source_id TEXT REFERENCES source_documents(id),
  chunk_id TEXT REFERENCES source_chunks(id),
  citation_key TEXT NOT NULL,
  title TEXT NOT NULL,
  issuer TEXT,
  publication_date TEXT,
  url TEXT,
  snippet TEXT,
  score REAL
);

CREATE INDEX idx_chat_citations_message ON chat_citations(message_id);

CREATE TABLE user_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  rating INTEGER,
  helpful INTEGER,
  comment_redacted TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_user_feedback_target ON user_feedback(target_type, target_id);

CREATE TABLE consent_events (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(id),
  consent_type TEXT NOT NULL,
  granted INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE library_lessons (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  pillar TEXT NOT NULL,
  issuer TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  last_reviewed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  estimated_reading_minutes INTEGER NOT NULL,
  body_markdown TEXT NOT NULL,
  source_document_id TEXT REFERENCES source_documents(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_library_lessons_category ON library_lessons(category, status);
