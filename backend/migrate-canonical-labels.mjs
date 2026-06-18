// One-off migration: relabel all 6 formats to canonical field names,
// and migrate existing saved mappings + compare configs so nothing breaks.
// Reversible: backs up formats/import_mappings/compare_configs to a JSON file
// before mutating; restore by replaying the backup.
import pg from "pg";
import { writeFileSync } from "fs";

const pool = new pg.Pool({
  host: "localhost",
  port: 5432,
  database: "accounting",
  user: "app",
  password: "ienf%*&kwnecFW",
});

// old format header -> new canonical label, per format key
const RENAMES = {
  QBO: {
    "Transaction date": "Date",
    Name: "Name",
    Description: "Employer/Organization",
    "Full name": "Category",
    "Item split account": "Account",
    Amount: "Amount",
  },
  LGL: {
    "Gift date": "Date",
    Name: "Name",
    "Employer/Organization": "Employer/Organization",
    "Gift category": "Category",
    "Payment Type": "Account",
    Amount: "Amount",
  },
  QBO_CLIENT_DUE_RECON: {
    Date: "Date",
    Num: "Number",
    "Customer full name": "Name",
    "Open balance": "Amount",
  },
  ONEBILL_CLIENT_DUE_RECON: {
    "Created Date": "Date",
    "Invoice Number": "Number",
    "Subscriber Name": "Name",
    "Total Due Amount": "Amount",
  },
  MIRITEL_ONEBILL_INVOICE_RECON: {
    "Original Invoice Date": "Date",
    "Invoice Number": "Number",
    "Subscriber Name": "Name",
    "Invoice Amount": "Amount",
  },
  MIRITEL_QBO_INVOICE_RECON: {
    Date: "Date",
    Num: "Number",
    Name: "Name",
    Amount: "Amount",
  },
};

// new header order per format (original order, renamed)
const NEW_HEADERS = {
  QBO: ["Date", "Name", "Employer/Organization", "Category", "Account", "Amount"],
  LGL: ["Date", "Name", "Employer/Organization", "Category", "Account", "Amount"],
  QBO_CLIENT_DUE_RECON: ["Date", "Number", "Name", "Amount"],
  ONEBILL_CLIENT_DUE_RECON: ["Date", "Number", "Name", "Amount"],
  MIRITEL_ONEBILL_INVOICE_RECON: ["Date", "Number", "Name", "Amount"],
  MIRITEL_QBO_INVOICE_RECON: ["Date", "Number", "Name", "Amount"],
};

const renameKeysOf = (obj, map) => {
  if (!map || !obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] ?? k] = v;
  return out;
};

const client = await pool.connect();
try {
  // ---- backup ----
  const formats = (await client.query("SELECT id, key, headers FROM formats")).rows;
  const mappings = (
    await client.query("SELECT id, import_id, format_key, mapping FROM import_mappings")
  ).rows;
  const configs = (
    await client.query(
      "SELECT id, left_format_key, right_format_key, compare_fields FROM compare_configs"
    )
  ).rows;

  const stamp = process.argv[2] || "backup";
  const backupPath = `${process.cwd()}/canonical-labels-${stamp}.json`;
  writeFileSync(backupPath, JSON.stringify({ formats, mappings, configs }, null, 2));
  console.log(`Backup written: ${backupPath}`);
  console.log(
    `Loaded: ${formats.length} formats, ${mappings.length} mappings, ${configs.length} compare configs`
  );

  await client.query("BEGIN");

  // ---- 1. formats.headers ----
  let fCount = 0;
  for (const f of formats) {
    if (!NEW_HEADERS[f.key]) continue;
    await client.query("UPDATE formats SET headers = $1 WHERE id = $2", [
      JSON.stringify(NEW_HEADERS[f.key]),
      f.id,
    ]);
    fCount++;
  }

  // ---- 2. import_mappings.mapping (rename keys) ----
  let mCount = 0;
  for (const m of mappings) {
    const map = RENAMES[m.format_key];
    if (!map) continue; // legacy/unknown format keys left untouched
    const next = renameKeysOf(m.mapping || {}, map);
    await client.query("UPDATE import_mappings SET mapping = $1 WHERE id = $2", [
      JSON.stringify(next),
      m.id,
    ]);
    mCount++;
  }

  // ---- 3. compare_configs.compare_fields (rewrite leftField/rightField) ----
  let cCount = 0;
  for (const c of configs) {
    const lmap = RENAMES[c.left_format_key];
    const rmap = RENAMES[c.right_format_key];
    if (!lmap && !rmap) continue;
    const fields = (c.compare_fields || []).map((fld) => ({
      ...fld,
      leftField: lmap?.[fld.leftField] ?? fld.leftField,
      rightField: rmap?.[fld.rightField] ?? fld.rightField,
    }));
    await client.query("UPDATE compare_configs SET compare_fields = $1 WHERE id = $2", [
      JSON.stringify(fields),
      c.id,
    ]);
    cCount++;
  }

  await client.query("COMMIT");
  console.log(`Updated: ${fCount} formats, ${mCount} mappings, ${cCount} compare configs`);
  console.log("Done.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
