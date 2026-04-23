import XLSX from "xlsx";
import Papa from "papaparse";

export function extOf(name = "") {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isBlankHeaderKey(key) {
  const s = String(key ?? "").trim();
  return !s || /^__EMPTY(?:_\d+)?$/i.test(s);
}

export function normalizeHeaderName(s) {
  return String(s ?? "").trim();
}

export function lower(s) {
  return String(s ?? "").trim().toLowerCase();
}

export function toInt(x, def) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

export function findHeader(headers = [], candidates = []) {
  const map = new Map(headers.map((h) => [lower(h), h]));
  for (const c of candidates) {
    const hit = map.get(lower(c));
    if (hit) return hit;
  }
  return null;
}

export function getNameParts(headers = []) {
  const firstNameHeader = findHeader(headers, [
    "First Name",
    "Firstname",
    "first_name",
    "Given Name",
  ]);

  const lastNameHeader = findHeader(headers, [
    "Last Name",
    "Lastname",
    "last_name",
    "Surname",
    "Family Name",
  ]);

  const nameHeader = findHeader(headers, [
    "Name",
    "Full Name",
    "Fullname",
    "full_name",
  ]);

  return { firstNameHeader, lastNameHeader, nameHeader };
}

export function ensureDerivedHeaders(headers = []) {
  const out = Array.isArray(headers) ? [...headers] : [];
  const { firstNameHeader, lastNameHeader, nameHeader } = getNameParts(out);

  if (firstNameHeader && lastNameHeader && !nameHeader && !out.includes("Name")) {
    const lastIdx = out.findIndex((h) => h === lastNameHeader);
    if (lastIdx >= 0) {
      out.splice(lastIdx + 1, 0, "Name");
    } else {
      out.push("Name");
    }
  }

  return out;
}

export function addDerivedFieldsToRow(data = {}, headers = []) {
  const out = { ...(data || {}) };
  const { firstNameHeader, lastNameHeader } = getNameParts(headers);

  if (firstNameHeader && lastNameHeader) {
    const first = String(out[firstNameHeader] ?? "").trim();
    const last = String(out[lastNameHeader] ?? "").trim();
    const full = [first, last].filter(Boolean).join(" ").trim();

    if (!String(out.Name ?? "").trim()) {
      out.Name = full;
    }
  }

  return out;
}

export function parseCsv(buffer, skipRows = 0) {
  const text = buffer.toString("utf8");
  const skip = Math.max(0, Math.trunc(skipRows));

  let source = text;
  if (skip > 0) {
    const lines = text.split(/\r?\n/);
    source = lines.slice(skip).join("\n");
  }

  const res = Papa.parse(source, { header: true, skipEmptyLines: true });

  if (res.errors?.length) {
    throw new Error(res.errors[0].message || "CSV parse error");
  }

  const rows = Array.isArray(res.data) ? res.data : [];
  const headers =
    res.meta?.fields?.length
      ? res.meta.fields
      : rows.length
        ? Object.keys(rows[0])
        : [];

  return { headers, rows };
}

export function parseExcel(buffer, skipRows = 0) {
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) throw new Error("Excel file has no sheets");

  const ws = wb.Sheets[sheetName];
  const skip = Math.max(0, Math.trunc(skipRows));

  const rows = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false,
    dateNF: "m/d/yyyy",
    ...(skip > 0 ? { range: skip } : {}),
  });

  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export function parseFile(file, skipRows = 0) {
  const name = file?.originalname || "file";
  const ext = extOf(name);

  if (ext === "csv" || file.mimetype?.includes("csv")) {
    return { kind: "csv", ...parseCsv(file.buffer, skipRows) };
  }

  if (ext === "xlsx" || ext === "xls") {
    return { kind: "excel", ...parseExcel(file.buffer, skipRows) };
  }

  try {
    return { kind: "csv", ...parseCsv(file.buffer, skipRows) };
  } catch (_) {
    // ignore fallback
  }

  throw new Error(`Unsupported file type: ${name} (use .csv, .xlsx, .xls)`);
}

export async function insertRowsBatch(client, fileId, rows, batchSize = 500) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);

    const values = [];
    const params = [];
    let p = 1;

    for (let i = 0; i < chunk.length; i++) {
      values.push(`($${p++}, $${p++}, $${p++}::jsonb)`);
      params.push(fileId, start + i, JSON.stringify(chunk[i] ?? {}));
    }

    await client.query(
      `INSERT INTO import_rows (file_id, row_index, data)
       VALUES ${values.join(", ")}
       ON CONFLICT (file_id, row_index)
       DO UPDATE SET data = EXCLUDED.data`,
      params
    );
  }
}