-- Full database schema for bookkeeping_review
-- Safe to run on a fresh database or an existing one (all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- The backend also runs this automatically on startup via initDb(), so manual execution is optional.

CREATE TABLE IF NOT EXISTS imports (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_files (
  id         SERIAL PRIMARY KEY,
  import_id  INTEGER REFERENCES imports(id) ON DELETE CASCADE,
  side       TEXT,
  name       TEXT,
  headers    JSONB,
  row_count  INTEGER
);

CREATE TABLE IF NOT EXISTS import_rows (
  id         SERIAL PRIMARY KEY,
  file_id    INTEGER REFERENCES import_files(id) ON DELETE CASCADE,
  row_index  INTEGER,
  data       JSONB,
  UNIQUE (file_id, row_index)
);

CREATE TABLE IF NOT EXISTS import_mappings (
  id         SERIAL PRIMARY KEY,
  import_id  INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  panel_key  TEXT NOT NULL,
  file_side  TEXT NOT NULL,
  format_key TEXT NOT NULL,
  mapping    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (import_id, panel_key)
);

CREATE TABLE IF NOT EXISTS formats (
  id         SERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  headers    JSONB NOT NULL DEFAULT '[]',
  labels     JSONB NOT NULL DEFAULT '[]',
  default_mapping JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE formats ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '[]';
ALTER TABLE formats ADD COLUMN IF NOT EXISTS default_mapping JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS row_edits (
  id         SERIAL PRIMARY KEY,
  import_id  INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  pair_id    TEXT NOT NULL,
  versions   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, pair_id)
);

CREATE TABLE IF NOT EXISTS compare_configs (
  id                  SERIAL PRIMARY KEY,
  left_format_key     TEXT NOT NULL,
  right_format_key    TEXT NOT NULL,
  compare_fields      JSONB NOT NULL DEFAULT '[]',
  minimum_match_count INTEGER NOT NULL DEFAULT 2,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (left_format_key, right_format_key)
);

INSERT INTO formats (key, label, headers) VALUES
  ('QBO', 'QBO format', '["Transaction date","Name","Line description","Category","Account","Amount"]'),
  ('LGL', 'LGL format', '["Gift date","Name","Employer/Organization","Gift category","Payment Type","Amount"]')
ON CONFLICT (key) DO NOTHING;
