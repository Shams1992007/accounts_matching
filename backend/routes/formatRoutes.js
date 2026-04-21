import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, key, label, headers, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM formats
       ORDER BY id ASC`
    );
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to list formats" });
  }
});

router.post("/", async (req, res) => {
  const key = String(req.body?.key || "").trim();
  const label = String(req.body?.label || "").trim();
  const headers = req.body?.headers;

  if (!key) return res.status(400).json({ error: "key is required" });
  if (!label) return res.status(400).json({ error: "label is required" });
  if (!Array.isArray(headers) || headers.length === 0)
    return res.status(400).json({ error: "headers must be a non-empty array" });

  const cleaned = headers.map((h) => String(h || "").trim()).filter(Boolean);
  if (cleaned.length === 0)
    return res.status(400).json({ error: "headers must contain at least one non-empty value" });

  try {
    const r = await pool.query(
      `INSERT INTO formats (key, label, headers)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, key, label, headers, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [key, label, JSON.stringify(cleaned)]
    );
    return res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: `A format with key "${key}" already exists` });
    }
    return res.status(500).json({ error: e?.message || "Failed to create format" });
  }
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const key = String(req.body?.key || "").trim();
  const label = String(req.body?.label || "").trim();
  const headers = req.body?.headers;

  if (!key) return res.status(400).json({ error: "key is required" });
  if (!label) return res.status(400).json({ error: "label is required" });
  if (!Array.isArray(headers) || headers.length === 0)
    return res.status(400).json({ error: "headers must be a non-empty array" });

  const cleaned = headers.map((h) => String(h || "").trim()).filter(Boolean);
  if (cleaned.length === 0)
    return res.status(400).json({ error: "headers must contain at least one non-empty value" });

  try {
    const r = await pool.query(
      `UPDATE formats
       SET key = $1, label = $2, headers = $3::jsonb, updated_at = now()
       WHERE id = $4
       RETURNING id, key, label, headers, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [key, label, JSON.stringify(cleaned), id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Format not found" });
    return res.json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: `A format with key "${key}" already exists` });
    }
    return res.status(500).json({ error: e?.message || "Failed to update format" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  try {
    // Check if this format key is in use by any saved mapping
    const fmt = await pool.query(`SELECT key FROM formats WHERE id = $1`, [id]);
    if (!fmt.rows.length) return res.status(404).json({ error: "Format not found" });

    const inUse = await pool.query(
      `SELECT COUNT(*) AS cnt FROM import_mappings WHERE format_key = $1`,
      [fmt.rows[0].key]
    );
    if (parseInt(inUse.rows[0].cnt, 10) > 0) {
      return res.status(409).json({
        error: "Cannot delete — this format is used by one or more saved mappings",
      });
    }

    await pool.query(`DELETE FROM formats WHERE id = $1`, [id]);
    return res.json({ ok: true, deletedId: id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to delete format" });
  }
});

export default router;
