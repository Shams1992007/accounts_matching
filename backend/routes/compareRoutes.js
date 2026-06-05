import { Router } from "express";
import { pool } from "../db.js";
import { buildCompareRows } from "../../frontend/src/utils/compareUtils.js";

const router = Router();

// POST /api/imports/:id/compare
// Body: { panel1, panel2, compareFields }
//   panel{1,2}: { fileSide: "A"|"B", mapping: {formatHeader: srcHeader}, headers: [...] }
//   compareFields: [{ key, label, leftField, rightField, required }]
// Loads ALL rows for both files, projects through mapping, runs buildCompareRows.
router.post("/:id/compare", async (req, res) => {
  const importId = Number(req.params.id);
  if (!Number.isFinite(importId)) {
    return res.status(400).json({ error: "invalid import id" });
  }

  const { panel1, panel2, compareFields } = req.body || {};
  if (!panel1?.fileSide || !panel2?.fileSide) {
    return res.status(400).json({ error: "panel1.fileSide and panel2.fileSide required" });
  }
  if (!Array.isArray(compareFields)) {
    return res.status(400).json({ error: "compareFields must be an array" });
  }

  try {
    const filesRes = await pool.query(
      "SELECT id, side FROM import_files WHERE import_id = $1",
      [importId]
    );
    const fileBySide = {};
    for (const r of filesRes.rows) fileBySide[r.side] = r.id;
    const file1Id = fileBySide[panel1.fileSide];
    const file2Id = fileBySide[panel2.fileSide];
    if (!file1Id || !file2Id) {
      return res.status(404).json({ error: "files not found for this import" });
    }

    const loadProjected = async (fileId, mapping = {}, headers = []) => {
      const { rows } = await pool.query(
        "SELECT row_index, data FROM import_rows WHERE file_id = $1 ORDER BY row_index",
        [fileId]
      );
      return rows.map((r) => {
        const out = { __rowKey: r.row_index };
        for (const h of headers) {
          const src = mapping[h];
          out[h] = src ? r.data?.[src] ?? "" : "";
        }
        return out;
      });
    };

    const [leftRows, rightRows] = await Promise.all([
      loadProjected(file1Id, panel1.mapping, panel1.headers),
      loadProjected(file2Id, panel2.mapping, panel2.headers),
    ]);

    const result = buildCompareRows({ leftRows, rightRows, compareFields });

    res.json({
      matchedRows: result.matchedRows,
      unmatchedLeft: result.unmatchedLeft,
      unmatchedRight: result.unmatchedRight,
      counts: {
        leftTotal: leftRows.length,
        rightTotal: rightRows.length,
        matched: result.matchedRows.length,
      },
    });
  } catch (e) {
    console.error("compare error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
