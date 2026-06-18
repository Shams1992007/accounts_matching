// Reverse of migrate-canonical-labels.mjs: relabel all 6 formats back to their
// ORIGINAL descriptive headers, and migrate saved mappings + compare configs so
// nothing breaks. Backs up the current (canonical) state to a JSON file first.
import pg from "pg";
import { writeFileSync } from "fs";

const pool = new pg.Pool({
  host: "localhost",
  port: 5432,
  database: "accounting",
  user: "app",
  password: "ienf%*&kwnecFW",
});

// canonical label -> original header, per format key (inverse of the forward map)
const RENAMES = {
  QBO: {
    Date: "Transaction date",
    Name: "Name",
    "Employer/Organization": "Description",
    Category: "Full name",
    Account: "Item split account",
    Amount: "Amount",
  },
  LGL: {
    Date: "Gift date",
    Name: "Name",
    "Employer/Organization": "Employer/Organization",
    Category: "Gift category",
    Account: "Payment Type",
    Amount: "Amount",
  },
  QBO_CLIENT_DUE_RECON: {
    Date: "Date",
    Number: "Num",
    Name: "Customer full name",
    Amount: "Open balance",
  },
  ONEBILL_CLIENT_DUE_RECON: {
    Date: "Created Date",
    Number: "Invoice Number",
    Name: "Subscriber Name",
    Amount: "Total Due Amount",
  },
  MIRITEL_ONEBILL_INVOICE_RECON: {
    Date: "Original Invoice Date",
    Number: "Invoice Number",
    Name: "Subscriber Name",
    Amount: "Invoice Amount",
  },
  MIRITEL_QBO_INVOICE_RECON: {
    Date: "Date",
    Number: "Num",
    Name: "Name",
    Amount: "Amount",
  },
};

// original header order per format
const NEW_HEADERS = {
  QBO: ["Transaction date", "Name", "Description", "Full name", "Item split account", "Amount"],
  LGL: ["Gift date", "Name", "Employer/Organization", "Gift category", "Payment Type", "Amount"],
  QBO_CLIENT_DUE_RECON: ["Date", "Num", "Customer full name", "Open balance"],
  ONEBILL_CLIENT_DUE_RECON: ["Created Date", "Invoice Number", "Subscriber Name", "Total Due Amount"],
  MIRITEL_ONEBILL_INVOICE_RECON: ["Original Invoice Date", "Invoice Number", "Subscriber Name", "Invoice Amount"],
  MIRITEL_QBO_INVOICE_RECON: ["Date", "Num", "Name", "Amount"],
};

const renameKeysOf = (obj, map) => {
  if (!map || !obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] ?? k] = v;
  return out;
};

const client = await pool.connect();
try {
  // ---- backup current (canonical) state ----
  const formats = (await client.query("SELECT id, key, headers FROM formats")).rows;
  const mappings = (
    await client.query("SELECT id, import_id, format_key, mapping FROM import_mappings")
  ).rows;
  const configs = (
    await client.query(
      "SELECT id, left_format_key, right_format_key, compare_fields FROM compare_configs"
    )
  ).rows;

  const stamp = process.argv[2] || "after-canonical";
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
    if (!map) continue;
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
