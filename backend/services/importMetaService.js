import { ensureDerivedHeaders } from "../utils/importHelpers.js";

export function decorateFileMetaRow(fileRow) {
  if (!fileRow) return fileRow;
  return {
    ...fileRow,
    headers: ensureDerivedHeaders(fileRow.headers || []),
  };
}

export async function getSavedMappings(client, importId) {
  const r = await client.query(
    `SELECT panel_key AS "panelKey", file_side AS "fileSide", format_key AS "formatKey", mapping
     FROM import_mappings
     WHERE import_id = $1
     ORDER BY panel_key`,
    [importId]
  );

  return r.rows;
}

export async function getImportMeta(client, importId) {
  const imp = await client.query(
    "SELECT id, created_at FROM imports WHERE id = $1",
    [importId]
  );

  if (!imp.rows.length) return null;

  const files = await client.query(
    `SELECT
       id AS "fileId",
       side,
       name,
       NULL::text AS type,
       headers,
       row_count AS "rowCount"
     FROM import_files
     WHERE import_id = $1
     ORDER BY side ASC`,
    [importId]
  );

  const decorated = files.rows.map(decorateFileMetaRow);
  const fileA = decorated.find((x) => x.side === "A") || null;
  const fileB = decorated.find((x) => x.side === "B") || null;
  const savedMappings = await getSavedMappings(client, importId);

  return {
    importId: imp.rows[0].id,
    createdAt: imp.rows[0].created_at,
    fileA,
    fileB,
    savedMappings,
  };
}