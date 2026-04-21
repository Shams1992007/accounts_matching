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
