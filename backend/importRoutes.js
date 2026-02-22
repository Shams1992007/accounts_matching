import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Papa from "papaparse";
import { pool } from "./db.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function extOf(name = "") {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function parseCsv(buffer) {
  const text = buffer.toString("utf8");
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (res.errors?.length) throw new Error(res.errors[0].message || "CSV parse error");
  const rows = Array.isArray(res.data) ? res.data : [];
  const headers = res.meta?.fields?.length ? res.meta.fields : rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new Error("Excel file has no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function parseFile(file) {
  const name = file?.originalname || "file";
  const ext = extOf(name);

  if (ext === "csv" || file.mimetype?.includes("csv")) return { kind: "csv", ...parseCsv(file.buffer) };
  if (ext === "xlsx" || ext === "xls") return { kind: "excel", ...parseExcel(file.buffer) };

  // fallback try csv
  try {
    return { kind: "csv", ...parseCsv(file.buffer) };
  } catch (_) {}

  throw new Error(`Unsupported file type: ${name} (use .csv, .xlsx, .xls)`);
}

function toInt(x, def) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

async function insertRowsBatch(client, importFileId, rows, batchSize = 500) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);

    const values = [];
    const params = [];
    let p = 1;

    for (let i = 0; i < chunk.length; i++) {
      values.push(`($${p++}, $${p++}, $${p++}::jsonb)`);
      params.push(importFileId, start + i, JSON.stringify(chunk[i] ?? {}));
    }

    await client.query(
      `INSERT INTO import_rows (import_file_id, row_index, data)
       VALUES ${values.join(", ")}
       ON CONFLICT (import_file_id, row_index) DO UPDATE SET data = EXCLUDED.data`,
      params
    );
  }
}

/**
 * GET /api/import/list
 * list recent imports (with file names + ids)
 */
router.get("/list", async (_req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        i.id AS import_id,
        i.created_at,
        MAX(CASE WHEN f.side='A' THEN f.id END) AS file_a_id,
        MAX(CASE WHEN f.side='A' THEN f.filename END) AS file_a_name,
        MAX(CASE WHEN f.side='B' THEN f.id END) AS file_b_id,
        MAX(CASE WHEN f.side='B' THEN f.filename END) AS file_b_name
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

/**
 * POST /api/import/create
 * multipart fields: fileA, fileB
 * creates import + two import_files + all import_rows
 */
router.post(
  "/create",
  upload.fields([
    { name: "fileA", maxCount: 1 },
    { name: "fileB", maxCount: 1 },
  ]),
  async (req, res) => {
    const a = req.files?.fileA?.[0];
    const b = req.files?.fileB?.[0];
    if (!a || !b) return res.status(400).json({ error: "Both files are required (fileA, fileB)." });

    try {
      const parsedA = parseFile(a);
      const parsedB = parseFile(b);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const imp = await client.query("INSERT INTO imports DEFAULT VALUES RETURNING id, created_at");
        const importId = imp.rows[0].id;

        const fa = await client.query(
          `INSERT INTO import_files (import_id, side, filename, filetype, headers, row_count)
           VALUES ($1,'A',$2,$3,$4::jsonb,$5)
           RETURNING id`,
          [importId, a.originalname, parsedA.kind, JSON.stringify(parsedA.headers), parsedA.rows.length]
        );
        const fileAId = fa.rows[0].id;

        const fb = await client.query(
          `INSERT INTO import_files (import_id, side, filename, filetype, headers, row_count)
           VALUES ($1,'B',$2,$3,$4::jsonb,$5)
           RETURNING id`,
          [importId, b.originalname, parsedB.kind, JSON.stringify(parsedB.headers), parsedB.rows.length]
        );
        const fileBId = fb.rows[0].id;

        await insertRowsBatch(client, fileAId, parsedA.rows);
        await insertRowsBatch(client, fileBId, parsedB.rows);

        await client.query("COMMIT");

        return res.json({
          importId,
          createdAt: imp.rows[0].created_at,
          fileA: { fileId: fileAId, name: a.originalname, type: parsedA.kind, headers: parsedA.headers, rowCount: parsedA.rows.length },
          fileB: { fileId: fileBId, name: b.originalname, type: parsedB.kind, headers: parsedB.headers, rowCount: parsedB.rows.length },
        });
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

/**
 * GET /api/import/file/:fileId/rows?page=1&limit=200
 * returns paginated rows for one file
 */
router.get("/file/:fileId/rows", async (req, res) => {
  const fileId = toInt(req.params.fileId, 0);
  if (!fileId) return res.status(400).json({ error: "Invalid fileId" });

  const limit = Math.min(Math.max(toInt(req.query.limit, 200), 1), 1000);
  const page = Math.max(toInt(req.query.page, 1), 1);
  const offset = (page - 1) * limit;

  const meta = await pool.query(
    `SELECT id, import_id, side, filename, filetype, headers, row_count
     FROM import_files WHERE id=$1`,
    [fileId]
  );
  if (!meta.rows.length) return res.status(404).json({ error: "File not found" });

  const r = await pool.query(
    `SELECT row_index, data
     FROM import_rows
     WHERE import_file_id=$1
     ORDER BY row_index
     LIMIT $2 OFFSET $3`,
    [fileId, limit, offset]
  );

  return res.json({
    file: meta.rows[0],
    page,
    limit,
    offset,
    rows: r.rows,
  });
});

/**
 * GET /api/import/:importId
 * returns import + both file metadata
 */
router.get("/:importId", async (req, res) => {
  const importId = toInt(req.params.importId, 0);
  if (!importId) return res.status(400).json({ error: "Invalid importId" });

  const imp = await pool.query("SELECT id, created_at FROM imports WHERE id=$1", [importId]);
  if (!imp.rows.length) return res.status(404).json({ error: "Import not found" });

  const files = await pool.query(
    `SELECT id AS "fileId", side, filename AS name, filetype AS type, headers, row_count AS "rowCount", created_at
     FROM import_files
     WHERE import_id=$1
     ORDER BY side ASC`,
    [importId]
  );

  const fileA = files.rows.find((x) => x.side === "A") || null;
  const fileB = files.rows.find((x) => x.side === "B") || null;

  return res.json({
    importId: imp.rows[0].id,
    createdAt: imp.rows[0].created_at,
    fileA,
    fileB,
  });
});

export default router;