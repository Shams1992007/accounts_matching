// Restore formats / import_mappings / compare_configs verbatim from a backup JSON
// produced by migrate-canonical-labels.mjs or revert-canonical-labels.mjs.
// Usage: node restore-from-backup.mjs <backup-file.json>
import pg from "pg";
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node restore-from-backup.mjs <backup-file.json>");
  process.exit(1);
}
const { formats = [], mappings = [], configs = [] } = JSON.parse(readFileSync(file, "utf8"));

const pool = new pg.Pool({
  host: "localhost",
  port: 5432,
  database: "accounting",
  user: "app",
  password: "ienf%*&kwnecFW",
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const f of formats) {
    await client.query("UPDATE formats SET headers = $1 WHERE id = $2", [
      JSON.stringify(f.headers),
      f.id,
    ]);
  }
  for (const m of mappings) {
    await client.query("UPDATE import_mappings SET mapping = $1 WHERE id = $2", [
      JSON.stringify(m.mapping),
      m.id,
    ]);
  }
  for (const c of configs) {
    await client.query("UPDATE compare_configs SET compare_fields = $1 WHERE id = $2", [
      JSON.stringify(c.compare_fields),
      c.id,
    ]);
  }
  await client.query("COMMIT");
  console.log(
    `Restored: ${formats.length} formats, ${mappings.length} mappings, ${configs.length} compare configs from ${file}`
  );
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
