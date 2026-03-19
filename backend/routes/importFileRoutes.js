import express from "express";
import { pool } from "../db.js";
import {
  toInt,
  normalizeHeaderName,
  isBlankHeaderKey,
  lower,
  ensureDerivedHeaders,
  addDerivedFieldsToRow,
} from "../utils/importHelpers.js";
import { getImportMeta } from "../services/importMetaService.js";

const router = express.Router();

router.patch("/file/:fileId/headers", async (req, res) => {
  const fileId = toInt(req.params.fileId, 0);
  if (!fileId) return res.status(400).json({ error: "Invalid fileId" });

  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (!updates.length) {
    return res.status(400).json({ error: "No header updates provided" });
  }

  const cleanUpdates = updates.map((x) => ({
    from: String(x?.from ?? ""),
    to: normalizeHeaderName(x?.to),
  }));

  for (const u of cleanUpdates) {
    if (!u.from) return res.status(400).json({ error: "Invalid source header" });
    if (!u.to) return res.status(400).json({ error: "New header name cannot be empty" });
    if (isBlankHeaderKey(u.to)) {
      return res.status(400).json({ error: "New header name cannot be blank" });
    }
  }

  const toNamesLower = cleanUpdates.map((x) => lower(x.to));
  if (new Set(toNamesLower).size !== toNamesLower.length) {
    return res.status(400).json({ error: "Duplicate new header names are not allowed" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const meta = await client.query(
      `SELECT id, import_id, headers FROM import_files WHERE id = $1`,
      [fileId]
    );

    if (!meta.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "File not found" });
    }

    const file = meta.rows[0];
    const headers = Array.isArray(file.headers) ? [...file.headers] : [];
    const map = new Map(cleanUpdates.map((x) => [x.from, x.to]));

    for (const u of cleanUpdates) {
      if (!headers.includes(u.from)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Header not found in file: ${u.from}` });
      }
    }

    const newHeaders = headers.map((h) => (map.has(h) ? map.get(h) : h));
    const normalizedHeaderKeys = newHeaders.map((h) => lower(h));

    if (new Set(normalizedHeaderKeys).size !== normalizedHeaderKeys.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Header names must be unique after update" });
    }

    const rows = await client.query(
      `SELECT row_index, data
       FROM import_rows
       WHERE file_id = $1
       ORDER BY row_index`,
      [fileId]
    );

    for (const row of rows.rows) {
      const oldData = row.data || {};
      const newData = {};

      for (const [key, value] of Object.entries(oldData)) {
        const nextKey = map.has(key) ? map.get(key) : key;

        if (!(nextKey in newData)) {
          newData[nextKey] = value;
        } else if (
          (newData[nextKey] === "" || newData[nextKey] == null) &&
          value !== "" &&
          value != null
        ) {
          newData[nextKey] = value;
        }
      }

      await client.query(
        `UPDATE import_rows
         SET data = $1::jsonb
         WHERE file_id = $2 AND row_index = $3`,
        [JSON.stringify(newData), fileId, row.row_index]
      );
    }

    await client.query(
      `UPDATE import_files
       SET headers = $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(newHeaders), fileId]
    );

    await client.query("COMMIT");

    const updatedMeta = await getImportMeta(client, file.import_id);
    return res.json(updatedMeta);
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: e?.message || "Header update failed" });
  } finally {
    client.release();
  }
});

router.get("/file/:fileId/rows", async (req, res) => {
  const fileId = toInt(req.params.fileId, 0);
  if (!fileId) return res.status(400).json({ error: "Invalid fileId" });

  const limit = Math.min(Math.max(toInt(req.query.limit, 200), 1), 1000);
  const page = Math.max(toInt(req.query.page, 1), 1);
  const offset = (page - 1) * limit;

  try {
    const meta = await pool.query(
      `SELECT id, import_id, side, name, headers, row_count
       FROM import_files
       WHERE id = $1`,
      [fileId]
    );

    if (!meta.rows.length) {
      return res.status(404).json({ error: "File not found" });
    }

    const headers = ensureDerivedHeaders(meta.rows[0].headers || []);

    const r = await pool.query(
      `SELECT row_index, data
       FROM import_rows
       WHERE file_id = $1
       ORDER BY row_index
       LIMIT $2 OFFSET $3`,
      [fileId, limit, offset]
    );

    const rows = r.rows.map((x) => ({
      ...x,
      data: addDerivedFieldsToRow(x.data || {}, headers),
    }));

    return res.json({
      file: {
        ...meta.rows[0],
        filename: meta.rows[0].name,
        headers,
      },
      page,
      limit,
      offset,
      rows,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Failed to fetch file rows" });
  }
});

export default router;