import express from "express";
import { pool } from "../db.js";
import { FORMATS, toInt } from "../utils/importHelpers.js";

const router = express.Router();

router.get("/:importId/mappings", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  if (!importId) return res.status(400).json({ error: "Invalid importId" });

  try {
    const r = await pool.query(
      `SELECT panel_key AS "panelKey", file_side AS "fileSide", format_key AS "formatKey", mapping
       FROM import_mappings
       WHERE import_id = $1
       ORDER BY panel_key`,
      [importId]
    );
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to load mappings" });
  }
});

router.put("/:importId/mappings/:panelKey", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  const panelKey = String(req.params.panelKey || "").trim();

  if (!importId) return res.status(400).json({ error: "Invalid importId" });
  if (!panelKey) return res.status(400).json({ error: "Invalid panelKey" });

  const fileSide = String(req.body?.fileSide || "").trim();
  const formatKey = String(req.body?.formatKey || "").trim();
  const mapping = req.body?.mapping || {};

  if (!["A", "B"].includes(fileSide)) {
    return res.status(400).json({ error: "fileSide must be A or B" });
  }

  if (!FORMATS[formatKey]) {
    return res.status(400).json({ error: "Invalid formatKey" });
  }

  const requiredHeaders = FORMATS[formatKey].headers;
  for (const h of requiredHeaders) {
    if (!String(mapping?.[h] || "").trim()) {
      return res.status(400).json({ error: `Missing mapping for ${h}` });
    }
  }

  try {
    await pool.query(
      `INSERT INTO import_mappings (import_id, panel_key, file_side, format_key, mapping, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (import_id, panel_key)
       DO UPDATE SET
         file_side = EXCLUDED.file_side,
         format_key = EXCLUDED.format_key,
         mapping = EXCLUDED.mapping,
         updated_at = now()`,
      [importId, panelKey, fileSide, formatKey, JSON.stringify(mapping)]
    );

    const r = await pool.query(
      `SELECT panel_key AS "panelKey", file_side AS "fileSide", format_key AS "formatKey", mapping
       FROM import_mappings
       WHERE import_id = $1 AND panel_key = $2`,
      [importId, panelKey]
    );

    return res.json(r.rows[0]);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to save mapping" });
  }
});

export default router;