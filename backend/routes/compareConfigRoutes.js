import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// GET /api/compare-configs?leftFormat=X&rightFormat=Y
router.get("/", async (req, res) => {
  const { leftFormat, rightFormat } = req.query;
  if (!leftFormat || !rightFormat) {
    return res.status(400).json({ error: "leftFormat and rightFormat are required" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT compare_fields, minimum_match_count
       FROM compare_configs
       WHERE left_format_key = $1 AND right_format_key = $2`,
      [leftFormat, rightFormat]
    );
    if (!rows.length) return res.json(null);
    res.json({
      compareFields: rows[0].compare_fields,
      minimumMatchCount: rows[0].minimum_match_count,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/compare-configs?leftFormat=X&rightFormat=Y
router.put("/", async (req, res) => {
  const { leftFormat, rightFormat } = req.query;
  if (!leftFormat || !rightFormat) {
    return res.status(400).json({ error: "leftFormat and rightFormat are required" });
  }
  const { compareFields, minimumMatchCount } = req.body;
  if (!Array.isArray(compareFields)) {
    return res.status(400).json({ error: "compareFields must be an array" });
  }
  try {
    await pool.query(
      `INSERT INTO compare_configs (left_format_key, right_format_key, compare_fields, minimum_match_count, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (left_format_key, right_format_key)
       DO UPDATE SET compare_fields = $3, minimum_match_count = $4, updated_at = now()`,
      [leftFormat, rightFormat, JSON.stringify(compareFields), minimumMatchCount ?? 2]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
