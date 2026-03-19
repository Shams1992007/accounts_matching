import express from "express";
import multer from "multer";
import { pool } from "../db.js";
import { parseFile, toInt, insertRowsBatch } from "../utils/importHelpers.js";
import { getImportMeta } from "../services/importMetaService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/list", async (_req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        i.id AS import_id,
        i.created_at,
        MAX(CASE WHEN f.side = 'A' THEN f.id END) AS file_a_id,
        MAX(CASE WHEN f.side = 'A' THEN f.name END) AS file_a_name,
        MAX(CASE WHEN f.side = 'B' THEN f.id END) AS file_b_id,
        MAX(CASE WHEN f.side = 'B' THEN f.name END) AS file_b_name
      FROM imports i
      JOIN import_files f ON f.import_id = i.id
      GROUP BY i.id, i.created_at
      ORDER BY i.id DESC
      LIMIT 100
      `
    );

    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to list imports" });
  }
});

router.post(
  "/create",
  upload.fields([
    { name: "fileA", maxCount: 1 },
    { name: "fileB", maxCount: 1 },
  ]),
  async (req, res) => {
    const a = req.files?.fileA?.[0];
    const b = req.files?.fileB?.[0];

    if (!a || !b) {
      return res.status(400).json({ error: "Both files are required (fileA, fileB)." });
    }

    try {
      const parsedA = parseFile(a);
      const parsedB = parseFile(b);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const imp = await client.query(
          "INSERT INTO imports DEFAULT VALUES RETURNING id, created_at"
        );
        const importId = imp.rows[0].id;

        const fa = await client.query(
          `INSERT INTO import_files (import_id, side, name, headers, row_count)
           VALUES ($1, 'A', $2, $3::jsonb, $4)
           RETURNING id`,
          [importId, a.originalname, JSON.stringify(parsedA.headers), parsedA.rows.length]
        );

        const fb = await client.query(
          `INSERT INTO import_files (import_id, side, name, headers, row_count)
           VALUES ($1, 'B', $2, $3::jsonb, $4)
           RETURNING id`,
          [importId, b.originalname, JSON.stringify(parsedB.headers), parsedB.rows.length]
        );

        await insertRowsBatch(client, fa.rows[0].id, parsedA.rows);
        await insertRowsBatch(client, fb.rows[0].id, parsedB.rows);

        await client.query("COMMIT");

        const meta = await getImportMeta(client, importId);
        return res.json(meta);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      return res.status(400).json({ error: e?.message || "Import failed" });
    }
  }
);

router.put(
  "/:importId/replace",
  upload.fields([
    { name: "fileA", maxCount: 1 },
    { name: "fileB", maxCount: 1 },
  ]),
  async (req, res) => {
    const importId = toInt(req.params.importId, 0);
    if (!importId) return res.status(400).json({ error: "Invalid importId" });

    const a = req.files?.fileA?.[0];
    const b = req.files?.fileB?.[0];

    if (!a || !b) {
      return res.status(400).json({ error: "Both replacement files are required (fileA, fileB)." });
    }

    try {
      const parsedA = parseFile(a);
      const parsedB = parseFile(b);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const impCheck = await client.query(
          "SELECT id FROM imports WHERE id = $1",
          [importId]
        );

        if (!impCheck.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Import not found" });
        }

        const oldFiles = await client.query(
          `SELECT id FROM import_files WHERE import_id = $1`,
          [importId]
        );
        const oldFileIds = oldFiles.rows.map((x) => x.id);

        if (oldFileIds.length) {
          await client.query(
            `DELETE FROM import_rows WHERE file_id = ANY($1::int[])`,
            [oldFileIds]
          );
        }

        await client.query(`DELETE FROM import_files WHERE import_id = $1`, [importId]);
        await client.query(`DELETE FROM import_mappings WHERE import_id = $1`, [importId]);

        const fa = await client.query(
          `INSERT INTO import_files (import_id, side, name, headers, row_count)
           VALUES ($1, 'A', $2, $3::jsonb, $4)
           RETURNING id`,
          [importId, a.originalname, JSON.stringify(parsedA.headers), parsedA.rows.length]
        );

        const fb = await client.query(
          `INSERT INTO import_files (import_id, side, name, headers, row_count)
           VALUES ($1, 'B', $2, $3::jsonb, $4)
           RETURNING id`,
          [importId, b.originalname, JSON.stringify(parsedB.headers), parsedB.rows.length]
        );

        await insertRowsBatch(client, fa.rows[0].id, parsedA.rows);
        await insertRowsBatch(client, fb.rows[0].id, parsedB.rows);

        await client.query("COMMIT");

        const meta = await getImportMeta(client, importId);
        return res.json(meta);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      return res.status(400).json({ error: e?.message || "Replace failed" });
    }
  }
);

router.delete("/:importId", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  if (!importId) return res.status(400).json({ error: "Invalid importId" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const exists = await client.query("SELECT id FROM imports WHERE id = $1", [importId]);
    if (!exists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Import not found" });
    }

    const fileIdsRes = await client.query(
      `SELECT id FROM import_files WHERE import_id = $1`,
      [importId]
    );
    const fileIds = fileIdsRes.rows.map((x) => x.id);

    if (fileIds.length) {
      await client.query(`DELETE FROM import_rows WHERE file_id = ANY($1::int[])`, [fileIds]);
    }

    await client.query(`DELETE FROM import_mappings WHERE import_id = $1`, [importId]);
    await client.query(`DELETE FROM import_files WHERE import_id = $1`, [importId]);
    await client.query(`DELETE FROM imports WHERE id = $1`, [importId]);

    await client.query("COMMIT");
    return res.json({ ok: true, deletedImportId: importId });
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: e?.message || "Delete failed" });
  } finally {
    client.release();
  }
});

router.get("/:importId", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  if (!importId) return res.status(400).json({ error: "Invalid importId" });

  try {
    const client = await pool.connect();
    try {
      const meta = await getImportMeta(client, importId);
      if (!meta) return res.status(404).json({ error: "Import not found" });
      return res.json(meta);
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to fetch import" });
  }
});

export default router;