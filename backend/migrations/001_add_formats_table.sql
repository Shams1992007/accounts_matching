-- Migration: add formats table
-- Run this once on the server before starting the updated backend.
-- (The backend also runs this automatically via CREATE TABLE IF NOT EXISTS on startup,
--  so running this manually is optional but harmless.)

CREATE TABLE IF NOT EXISTS formats (
  id         SERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  headers    JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO formats (key, label, headers) VALUES
  ('QBO', 'QBO format', '["Transaction date","Name","Line description","Category","Account","Amount"]'),
  ('LGL', 'LGL format', '["Gift date","Name","Employer/Organization","Gift category","Payment Type","Amount"]')
ON CONFLICT (key) DO NOTHING;
