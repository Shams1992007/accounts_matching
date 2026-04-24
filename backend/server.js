import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import importRoutes from "./importRoutes.js";
import formatRoutes from "./routes/formatRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", ts: new Date().toISOString() });
});

app.use("/api/import", importRoutes);
app.use("/api/formats", formatRoutes);

async function initDb() {
  await pool.query(`
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

    CREATE TABLE IF NOT EXISTS row_edits (
      id         SERIAL PRIMARY KEY,
      import_id  INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
      pair_id    TEXT NOT NULL,
      versions   JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (import_id, pair_id)
    );

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
  `);
}

const PORT = process.env.PORT || 5020;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on :${PORT}`));
  })
  .catch((e) => {
    console.error("DB init failed:", e.message);
    process.exit(1);
  });
