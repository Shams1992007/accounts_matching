import express from "express";
import { pool } from "../db.js";
import { toInt } from "../utils/importHelpers.js";

const router = express.Router();

router.get("/:importId/row-edits", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  if (!importId) return res.status(400).json({ error: "Invalid importId" });

  try {
    const r = await pool.query(
      `SELECT pair_id AS "pairId", versions FROM row_edits WHERE import_id = $1`,
      [importId]
    );
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to load row edits" });
  }
});

router.put("/:importId/row-edits/:pairId", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  const pairId = String(req.params.pairId || "").trim();
  const { versions } = req.body;

  if (!importId) return res.status(400).json({ error: "Invalid importId" });
  if (!pairId) return res.status(400).json({ error: "Invalid pairId" });
  if (!Array.isArray(versions)) return res.status(400).json({ error: "versions must be an array" });

  try {
    await pool.query(
      `INSERT INTO row_edits (import_id, pair_id, versions, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (import_id, pair_id)
       DO UPDATE SET versions = $3, updated_at = now()`,
      [importId, pairId, JSON.stringify(versions)]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to save row edit" });
  }
});

export default router;
