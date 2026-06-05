# Accounts Matching

Reconciles two accounting files (CSV/XLSX). Upload File A and File B, map each to a named **format**, app finds matches between them. Unmatched rows can be paired manually. Exports CSV or Excel.

Typical use: matching a bank export (QBO) against a donations ledger (LGL).

## Deploy / restart

| | |
|---|---|
| Frontend | http://15.235.216.232:3001 (nginx → `frontend/dist/`) |
| Backend  | :5020, PM2 name `accounts-backend`, nginx `/etc/nginx/sites-enabled/accounts-matching` |

```bash
cd frontend && npm run build               # nginx serves dist/ immediately
pm2 restart accounts-backend               # after backend change
```

## Stack

Node 20 (ESM) + Express, Postgres 16, papaparse + xlsx, ExcelJS.
React 19 + Vite.

## End-to-end flow

### Manage Formats
DB-driven (`formats` table) — formats are not hardcoded. Each format = `{key, label, headers[]}`. QBO and LGL are seeded once on first startup. Delete is blocked if any saved mapping references the format.

### Step 1 — Import
Upload two files → backend parses, batch-inserts (500 rows/batch) into Postgres. If headers are missing (blank `__EMPTY_N`), the "Missing headers editor" lets the user name them in-place. **`Real headers are in row #` input is empty by default and triggers Preview via debounce (500ms) / Enter / blur / explicit Preview button.** Previous import sessions are listed with replace/delete.

### Step 2 — Format
Two side-by-side panels. User picks a target format from the DB-driven list and maps source columns to format headers. Mappings persist per import.

### Step 3 — Compare

Auto-matching scores every left-row against every right-row across **all** configured compare fields. A pair is kept (Results) when at least **`MIN_MATCHES_FOR_PAIR` = 2** fields match; the best-scoring still-available right-row wins for each left-row (greedy). Anything below the threshold falls to **Unmatched Rows**.

**Per-field Required/Optional flag — display only:**
- `required: true` → that comparison column is **shown** in the Results table.
- `required: false` → that column is **hidden** (still computed, still counts toward the match threshold).
- Ticks do **not** affect pair eligibility. Toggle freely.

Fields compared (configurable in Compare Setup, default `Date·Name·Category·Amount`).

Normalization: amounts strip `$,`, dates parse `m/d/yy(yy)`, category strips codes/prefixes & extracts tail from colon chains, name falls back to Employer/Organization (case-insensitive).

**Persistence:** Save-as-default stores the config per format pair in `compare_configs`. Schema keeps `compare_configs.compare_fields[].required` *and* legacy `minimum_match_count` for backward compat — but `minimum_match_count` is no longer consulted by the matcher; we now write the count of visible (Required) columns into it as a courtesy for older clients. sessionStorage caches per import.

**Row classification & colors (`CompareResultsTable`)** — judged on **visible (Required) fields only**, so hiding a column also removes it from the verdict:

| Color | Type | Meaning |
|---|---|---|
| No highlight | Truth | All *visible* compare fields matched |
| Blue | Conditional Truth | Name matched via Employer/Organization fallback (Name must be visible) |
| Red | False | One or more *visible* compare fields did not match |
| Green | Edited → Truth | Row was corrected by editing and now fully matches |

> **Theme:** white/light throughout. All backgrounds are `#fff`/`#f9fafb`/`#f3f4f6`. Primary buttons stay dark (`#111827`) for contrast. Active tabs are blue (`#1d4ed8`). **Do not reintroduce dark backgrounds.**

**Filter bar** above the table: All / Truth / Conditional Truth / False with live counts. `rowFilter` state lives in `CompareFormattedData` (not in the table) so the export can read it. Table maintains column min-widths so layout is stable across counts.

**Row editing:** Edit button on Conditional Truth, False, and Green rows. Inline edit mode turns all left/right cells into inputs; compare-field columns update live. Save re-scores + appends a new version to history; Cancel discards. Hovering an edited row reveals full version history (type per version, field results, exact diffs). Persisted to `row_edits`.

## Navigation / URL persistence

URL params drive page state across refreshes:

| URL | State |
|---|---|
| `?page=import&importId=5`   | Import page with import #5 |
| `?page=format&importId=5`   | Format page |
| `?page=compare&importId=5`  | Compare page (falls back to format if no sessionStorage cache) |
| `?page=formats`             | Manage Formats |
| `?page=guide`               | User Guide |

`importMeta` is re-fetched on refresh from the URL; `formattedPanels` is cached in `sessionStorage` per `importId`.

## Export

Mirrors exactly what's on the compare page — same columns, same section headers, respects active tab AND active filter.

Column layout: `[ Left panel headers ][ Right panel headers ][ Visible (Required) compare field labels ][ Amount Diff ]`. No separator columns. Compare-field headers use the label as-is (no `Match` suffix). `Amount Diff`, not `Amount Difference`. No `Match Type` column — CSV has no color, Excel uses row colors instead. Optional (unticked) compare columns are omitted from exports too.

Row 1 is a merged section header: `Left panel title · Right panel title · Do the records match?` Titles come from `leftPanel.title` / `rightPanel.title` (the format name).

| Active tab | Active filter | Exported rows |
|---|---|---|
| Results | All | All matched pairs |
| Results | Truth / Conditional / False | Only that type |
| Unmatched | — | Only unmatched left + right rows |

Excel extras: row colors match the compare page (Conditional → light blue, False → light red, Edited→Truth → light green, Unmatched → light yellow, Truth → no fill). TRUE/FALSE cells in compare columns get green/red fill. Frozen header rows 1–2, auto-fit widths.

Summary/totals rows are auto-filtered out.

## Database

| Table | Purpose |
|---|---|
| `imports` | One row per import session |
| `import_files` | File A/B metadata (name, headers, row count) |
| `import_rows` | Raw rows (JSONB per row, batched 500/insert) |
| `import_mappings` | Saved mappings (`panel_key`, `file_side`, `format_key`, `mapping` JSONB) |
| `formats` | User-defined formats (`key`, `label`, `headers` JSONB array) |
| `compare_configs` | Per-format-pair compare settings (`compare_fields[].required` + legacy `minimum_match_count`) |
| `row_edits` | Per-pair edit history (`import_id`, `pair_id`, `versions` JSONB array) |

All tables auto-created on backend startup via `initDb()`. Idempotent schema also in `backend/migrations/schema.sql`. QBO + LGL seeded via `ON CONFLICT DO NOTHING`.

## Env

```
PORT=5020
DATABASE_URL=postgres://app:secret@localhost:5432/accounting
```

## Run locally

```bash
cd backend  && npm install && npm run dev   # :5020
cd frontend && npm install && npm run dev   # :5173 (Vite)
```
