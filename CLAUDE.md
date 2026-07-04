# Bookkeeping Review

Reconciles two accounting files (CSV/XLSX). Upload File A and File B, map each to a named **format**, app finds matches between them. Unmatched rows can be paired manually. Exports CSV or Excel.

Typical use: matching a bank export (QBO) against a donations ledger (LGL).

## Deploy / restart

| | |
|---|---|
| Frontend | http://15.235.216.232:3001 (nginx → `frontend/dist/`) |
| Backend  | :5020, PM2 name `bookkeeping-backend` |
| Nginx    | `/etc/nginx/sites-enabled/bookkeeping-review` — proxies `/api/` and `/health` to `127.0.0.1:5020`, serves `frontend/dist/` for everything else (SPA fallback to `index.html`) |

```bash
cd frontend && npm run build               # nginx serves dist/ immediately
pm2 restart bookkeeping-backend            # after backend change
```

## Stack

Node 20 (ESM) + Express, **Postgres 14** (shared cluster — see project-hub CLAUDE.md), papaparse + xlsx + multer, ExcelJS (frontend only — exports built client-side).
React 19 + Vite.

## Repo layout

```
backend/
  server.js              # app entry, mounts routes, runs initDb() + seeds QBO/LGL
  db.js                  # pg Pool (uses DATABASE_URL or DB_* vars)
  importRoutes.js        # legacy aggregate — mounts importCrud/file/mapping/rowEdit
  routes/
    formatRoutes.js          # /api/formats CRUD
    compareConfigRoutes.js   # /api/compare-configs GET/PUT (per format pair)
    compareRoutes.js         # POST /api/imports/:id/compare (runs matcher)
    (importCrud/File/Mapping/rowEdit routes under routes/import/*)
  services/              # importMetaService etc. — header derivation, row helpers
  migrations/schema.sql  # idempotent mirror of initDb()

frontend/src/
  pages/
    ImportTwoFiles.jsx        # Step 1 — upload, parse, header editor, skip-rows
    FormatTwoFiles.jsx        # Step 2 — side-by-side mapping
    CompareFormattedData.jsx  # Step 3 — matcher, tabs, filter, export
    ManageFormats.jsx         # CRUD for formats table
    UserGuide.jsx
  components/
    common/   DataTable · ConfirmModal · Pager
    import/   FileUploadCard · ImportHeader · ImportLoadBar · MissingHeadersEditor · LoadedImportActions · ImportViewerToolbar
    format/   FormatPanel · FormattedTable · MappingRow
    compare/  CompareHeader · CompareTabs · CompareSetupPanel · CompareResultsTable · CompareUnmatchedPanel
  services/   importApi · formatsApi · compareApi · compareConfigApi · rowEditsApi
  utils/      compareUtils (matcher) · exportUtils (CSV/Excel)
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET    | `/health`, `/api/ping` | Health |
| GET    | `/api/import/list` | List imports (max 100) |
| POST   | `/api/import/create` | Upload fileA + fileB, parse, batch-insert |
| GET    | `/api/import/:importId` | Import metadata |
| PUT    | `/api/import/:importId/replace` | Replace both files |
| DELETE | `/api/import/:importId` | Delete (cascades) |
| PATCH  | `/api/import/file/:fileId/headers` | Rename blank `__EMPTY_N` headers |
| POST   | `/api/import/file/:fileId/apply-skip-rows` | Skip N leading rows, promote row N as headers |
| GET    | `/api/import/file/:fileId/rows` | Paginated preview (with derived fields) |
| GET/PUT| `/api/import/:importId/mappings[/:panelKey]` | Per-panel mapping persistence |
| GET/PUT| `/api/import/:importId/row-edits[/:pairId]` | Row-edit version history |
| GET/POST/PUT/DELETE | `/api/formats[/:id]` | Format CRUD (DELETE blocked if referenced by a mapping) |
| GET/PUT| `/api/compare-configs?leftFormat=X&rightFormat=Y` | Per format-pair compare config |
| POST   | `/api/imports/:id/compare` | Run matcher, return pairs + unmatched |

## End-to-end flow

### Manage Formats
DB-driven (`formats` table) — formats are not hardcoded. Each format = `{key, label, headers[]}`. QBO and LGL are seeded once on first startup. Delete is blocked if any saved mapping references the format.

### Step 1 — Import
Upload two files → backend parses (papaparse for CSV, xlsx for XLSX), batch-inserts (500 rows/batch) into Postgres. Three header-fix tools live on the same page:
- **Missing headers editor** — names blank `__EMPTY_N` columns in-place.
- **`Real headers are in row #`** — empty by default; debounce 500ms / Enter / blur / explicit Preview triggers preview. Apply calls `apply-skip-rows`, which discards rows above N and promotes that row to headers.
- **Derived `Name` column** — preview fills `Name` from `First Name` + `Last Name` when the source has those but no `Name`.

Previous import sessions are listed with replace/delete.

### Step 2 — Format
Two side-by-side panels. User picks a target format from the DB-driven list and maps source columns to format headers. Mappings persist per import.

### Step 3 — Compare

Auto-matching scores every left-row against every right-row across **all** configured compare fields. A pair is kept (Results) when at least **`MIN_MATCHES_FOR_PAIR` = 2** fields match (`compareUtils.js`); the best-scoring still-available right-row wins for each left-row (greedy). Anything below the threshold falls to **Unmatched Rows**.

**Standalone fully-filled rows (`addStandalonePairs`)** — after auto-match + manual pairing, any leftover row whose every compare field is non-empty (on its side) is also surfaced in Results as a False pair with the other side blank. The row stays in the Unmatched list so it can still be manually paired; once paired it leaves `unmatchedLeft`/`unmatchedRight` and the standalone entry disappears on the next render. Standalones are editable like any other False row, so the empty side can be filled in via inline edit and rescored. This runs purely on the frontend in `CompareFormattedData.jsx` — the backend `buildCompareRows` is unchanged.

**Per-field Required/Optional flag — display only:**
- `required: true` → that comparison column is **shown** in the Results table.
- `required: false` → that column is **hidden** (still computed, still counts toward the match threshold).
- Ticks do **not** affect pair eligibility. Toggle freely.

Fields compared (configurable in Compare Setup, default `Date·Name·Category·Amount`).

Normalization (`compareUtils.js`):
- **Amounts** — strip `$,`, parse float, compare with ±1e-6 tolerance.
- **Dates** — parse `m/d/yy(yy)`; 2-digit years 70–99 → 1900s, 00–69 → 2000s; fallback to `Date.parse`.
- **Category** — strip leading codes (`4007 Individuals` → `Individuals`), extract tail from colon chains (`A:B:C` → `C`), known-aliases map, substring-contains as last resort.
- **Name** — direct match, then employer fallback: `leftName == rightEmployer` or `rightName == leftEmployer` (both surface as Conditional Truth). `matchDetail.mode` records `name_to_name`, `left_name_to_right_employer`, or `right_name_to_left_employer` (plus `*_partial` shared-word variants). The Employer/Organization column is **resolved per panel** — the projected row is keyed by format header, and that header varies (QBO stores it under `Description`, LGL under `Employer/Organization`). `resolveEmployerField(panel)` finds it via the format's parallel `labels` array (label `Employer/Organization`); `withEmployerFields()` attaches the resolved `leftEmployerField`/`rightEmployerField` onto the Name compare field before matching (in `CompareFormattedData`, as `matchFields`), so the fallback fires regardless of how each format names the column. Do **not** re-hardcode `"Employer/Organization"` in `namesMatchWithFallback`. Panels carry `labels` in their payload (`FormatPanel`); for stale caches that predate it, labels are recovered from the `/api/formats` definition.
- **Text (default)** — case-insensitive, whitespace-normalized.

**Persistence:** Save-as-default stores the config per format pair in `compare_configs`. `compare_fields[].required` is the source of truth. `minimum_match_count` is kept in the schema and written as the count of visible (Required) columns purely as a courtesy for older clients — **the matcher no longer reads it**, it uses the hardcoded `MIN_MATCHES_FOR_PAIR = 2`. sessionStorage caches per import.

**Row classification & colors (`CompareResultsTable`)** — judged on **visible (Required) fields only**, so hiding a column also removes it from the verdict:

| Color | Type | Meaning |
|---|---|---|
| No highlight | Truth | All *visible* compare fields matched |
| Blue | Conditional Truth | Name matched via Employer/Organization fallback (Name must be visible) |
| Red | False | One or more *visible* compare fields did not match |
| Green | Edited → Truth | Row was corrected by editing and now fully matches |

> **Theme:** white/light throughout. All backgrounds are `#fff`/`#f9fafb`/`#f3f4f6` (a few light `linear-gradient` panels are fine). Primary buttons stay dark (`#111827`) for contrast. Active tabs are blue (`#1d4ed8`). **Do not reintroduce dark backgrounds.**

**Filter bar** above the table: All / Truth / Conditional Truth / False with live counts. `rowFilter` state lives in `CompareFormattedData` (not in the table) so the export can read it. Table maintains column min-widths so layout is stable across counts.

**Search + hide-one-sided** (above the filter bar): a free-text search box (`searchQuery`) does a case-insensitive substring match against every cell on both the left and right side; a "Hide one-sided rows" checkbox (`hideStandalone`) drops standalone (isStandalone) pairs from view. Both states live in `CompareFormattedData` and are passed to `CompareResultsTable` and to `exportCSV` / `exportExcel`, so the exported view always mirrors the on-screen view. Counts on the filter chips reflect `hideStandalone` (they shrink when one-sided rows are hidden) but **not** `searchQuery` — search narrows the visible rows within a type without rewriting the type populations. The unmatched export also respects `searchQuery` (one-sided toggle has no effect there).

**Row editing:** Edit button on Conditional Truth, False, and Green rows. Inline edit mode turns all left/right cells into inputs; compare-field columns update live. Save re-scores + appends a new version to history; Cancel discards. Hovering an edited row reveals full version history (type per version, field results, exact diffs). Persisted to `row_edits.versions` as a JSONB array of `{label, timestamp, type, leftRow, rightRow, matchDetail}`.

## Navigation / URL persistence

URL params drive page state across refreshes:

| URL | State |
|---|---|
| `?page=import&importId=5`   | Import page with import #5 |
| `?page=format&importId=5`   | Format page |
| `?page=compare&importId=5`  | Compare page (falls back to format if no sessionStorage cache) |
| `?page=formats`             | Manage Formats |
| `?page=guide`               | User Guide |

`importMeta` is re-fetched on refresh from the URL; `formattedPanels` is cached in `sessionStorage` per `importId` (`panels_${importId}`).

## Export

Mirrors exactly what's on the compare page — same columns, same section headers, respects active tab AND active filter.

Column layout: `[ Left panel headers ][ Right panel headers ][ Visible (Required) compare field labels ][ Amount Diff ]`. No separator columns. Compare-field headers use the label as-is (no `Match` suffix). `Amount Diff`, not `Amount Difference`. No `Match Type` column — CSV has no color, Excel uses row colors instead. Optional (unticked) compare columns are omitted from exports too.

Row 1 is a merged section header: `Left panel title · Right panel title · Do the records match?` Titles come from `leftPanel.title` / `rightPanel.title` (the format name).

| Active tab | Active filter | Exported rows |
|---|---|---|
| Results | All | All matched pairs |
| Results | Truth / Conditional / False | Only that type |
| Unmatched | — | Only unmatched left + right rows |

Excel extras: row colors match the compare page (Conditional → light blue, False → light red, Edited→Truth → light green, Unmatched → light yellow, Truth → no fill). TRUE/FALSE cells in compare columns get green/red fill (overrides row color). Frozen header rows 1–2, auto-fit widths.

Summary/totals rows are auto-filtered out (`isSummaryRow` heuristic in `exportUtils.js`).

## Database

| Table | Purpose |
|---|---|
| `imports` | One row per import session |
| `import_files` | File A/B metadata (name, headers JSONB, row_count); `side` is `A`/`B` |
| `import_rows` | Raw rows (JSONB per row, batched 500/insert); `UNIQUE(file_id, row_index)` |
| `import_mappings` | Saved mappings (`panel_key`, `file_side`, `format_key`, `mapping` JSONB); `UNIQUE(import_id, panel_key)` |
| `formats` | User-defined formats (`key` UNIQUE, `label`, `headers` JSONB array) |
| `compare_configs` | Per-format-pair compare settings (`compare_fields` JSONB with `[].required`, legacy `minimum_match_count`); `UNIQUE(left_format_key, right_format_key)` |
| `row_edits` | Per-pair edit history (`import_id`, `pair_id`, `versions` JSONB array); `UNIQUE(import_id, pair_id)` |

All tables auto-created on backend startup via `initDb()` (`server.js`). Idempotent mirror in `backend/migrations/schema.sql`. QBO + LGL seeded via `ON CONFLICT (key) DO NOTHING`.

## Env

```
PORT=5020
DATABASE_URL=postgres://app:secret@localhost:5432/accounting
# or, as a fallback, individual vars:
DB_HOST=localhost  DB_PORT=5432  DB_NAME=accounting  DB_USER=app  DB_PASSWORD=...
```

## Run locally

```bash
cd backend  && npm install && npm run dev   # :5020 (nodemon)
cd frontend && npm install && npm run dev   # :5173 (Vite)
```
