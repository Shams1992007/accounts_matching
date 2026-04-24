# Accounts Matching — Project Overview

## What This Is

A full-stack web app for **reconciling two accounting files** (CSV or Excel). You upload File A and File B, map each to a named format, and the app finds matching transactions between them. Unmatched rows can be paired manually. Results export to CSV or Excel.

Typical use case: matching a bank export (QBO format) against a donations ledger (LGL format).

---

## Deployment

| Layer | URL / Port |
|---|---|
| Frontend (Nginx → dist) | http://15.235.216.232:3001 |
| Backend API (PM2) | port 5020 |

**PM2 process name:** `accounts-backend`  
**Nginx config:** `/etc/nginx/sites-enabled/accounts-matching`  
**After any frontend change:** `npm run build` inside `frontend/`, Nginx serves from `frontend/dist/` automatically.  
**After any backend change:** `pm2 restart accounts-backend`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js (ESM), Express, PostgreSQL 16 |
| Frontend | React 19, Vite |
| File parsing | papaparse (CSV), xlsx (Excel) |
| Export | ExcelJS |

---

## How It Works — End to End

### Manage Formats (`ManageFormats` page)
- Formats are stored in the DB (`formats` table) — not hardcoded
- Each format has a **key** (e.g. `QBO`), a **label**, and an ordered list of **column headers**
- QBO and LGL are seeded automatically on first backend startup
- Users can create, edit, and delete formats
- Delete is blocked if the format is referenced by any saved mapping

### Step 1 — Import (`ImportTwoFiles` page)
- User uploads two files (CSV or XLSX)
- Backend parses headers and all rows, inserts everything into Postgres
- Frontend shows raw rows with pagination and sorting
- If any headers are missing (blank `__EMPTY_N` columns), user can name them in-place
- **Missing headers editor**: user types a row number in *Real headers are in row #* — preview fires automatically via debounce (500 ms), on Enter, on blur, or via the explicit **Preview** button beside the input. The input starts empty (no forced default).
- Previous import sessions are listed; old ones can be replaced or deleted

### Step 2 — Format (`FormatTwoFiles` page)
- Two side-by-side panels, one per file
- User picks a **target format** from the dynamic DB-driven list
- Maps each required column from the source file to the format's headers
- Mappings are saved to the DB and reused on reload
- Formatted preview is rendered on the fly from stored raw rows + mapping

### Step 3 — Compare (`CompareFormattedData` page)
- Auto-matching algorithm scores every left-row against every right-row
- A pair is kept if it scores ≥ 2 matching fields (configurable)
- Fields compared: Date, Name, Category, Amount
- Normalization handles messy real data:
  - Amounts: strips `$` and commas, compares numerically
  - Dates: parses `m/d/yy` and `m/d/yyyy` to ISO format
  - Category: strips codes/prefixes, extracts meaningful tail from colon-separated chains
  - Name: case-insensitive; falls back to Employer/Organization field
- Unmatched rows appear in a separate tab for **manual pairing**
- Export shows matched + unmatched side-by-side with per-field match flags

#### Row classification & colors (`CompareResultsTable`)
| Color | Type | Meaning |
|---|---|---|
| No highlight | **Truth** | All compare fields matched |
| Blue | **Conditional Truth** | Name matched via Employer/Organization fallback |
| Red | **False** | One or more compare fields did not match |
| Green | **Edited → Truth** | Row was corrected by editing and now fully matches |

#### Filtering
- Four filter buttons above the table: **All / Truth / Conditional Truth / False** (each shows count)
- Filtering updates row counts live; table maintains column min-widths so layout is stable at any row count

#### Row editing & history
- **Edit** button appears on every Conditional Truth and False row (and on green/edited rows for further correction)
- Clicking opens inline edit mode — all left/right cells become inputs; compare field columns update live as you type
- **Save** re-scores the pair and appends a new version to the history; **Cancel** discards changes
- A row edited N times has N+1 versions stored (original + each edit)
- If editing brings a row to Truth it turns **green**
- Hovering any edited row shows the full version history: what type each version was, field match results, and exactly what changed between versions
- Edit history is persisted to the DB (`row_edits` table) — survives page refresh

### User Guide (`UserGuide` page)
- Static reference page explaining all 4 steps, tips, and common issues
- Accessible from the top nav

---

## Navigation & URL Persistence

The app uses URL params to persist state across refreshes:

| URL | State |
|---|---|
| `?page=import&importId=5` | Import page with import #5 loaded |
| `?page=format&importId=5` | Format page |
| `?page=compare&importId=5` | Compare page |
| `?page=formats` | Manage Formats page |
| `?page=guide` | User Guide page |

- `importMeta` is re-fetched from the backend on refresh using the URL `importId`
- `formattedPanels` (compare page data) is cached in `sessionStorage` keyed by importId
- If refreshing on compare with no cached panels, falls back to the format page

---

## Export Format

Both CSV and Excel exports use a **three-section layout**:

```
[ File A columns ] | [ separator ] | [ File B columns ] | [ separator ] | [ Comparison columns ]
```

Comparison columns: Date Match, Name Match, Category Match, Amount Match, Amount Difference.

Excel export adds: merged section headers, green/red color coding for match flags, frozen header row, auto-fit column widths, and divider lines between sections.

Summary/totals rows are automatically filtered out of exports.

---

## Project Structure

```
accounts_matching/
├── backend/
│   ├── server.js              # Express entry point (port 5020); runs initDb() on startup
│   ├── db.js                  # Postgres connection pool
│   ├── importRoutes.js        # Import route aggregator
│   ├── routes/
│   │   ├── formatRoutes.js        # CRUD for formats (/api/formats)
│   │   ├── importCrudRoutes.js    # Create/list/delete imports, upload files
│   │   ├── importFileRoutes.js    # View rows, rename headers
│   │   ├── importMappingRoutes.js # Save/load format mappings (validates against DB formats)
│   │   └── rowEditRoutes.js       # GET/PUT row edit history per pair (/api/import/:id/row-edits)
│   ├── migrations/
│   │   ├── schema.sql             # Full idempotent schema (safe to re-run)
│   │   └── 001_add_formats_table.sql
│   ├── services/
│   │   └── importMetaService.js   # Decorated import metadata (auto First+Last → Name)
│   └── utils/
│       └── importHelpers.js       # File parsing, batch insert helpers
│
├── frontend/src/
│   ├── App.jsx                    # Top nav + 5-page shell + URL persistence
│   ├── pages/
│   │   ├── ImportTwoFiles.jsx
│   │   ├── FormatTwoFiles.jsx
│   │   ├── CompareFormattedData.jsx
│   │   ├── ManageFormats.jsx      # Format CRUD UI
│   │   └── UserGuide.jsx          # Static help/reference page
│   ├── components/
│   │   ├── common/            # DataTable, Pager, ConfirmModal
│   │   ├── import/
│   │   │   ├── FileUploadCard.jsx
│   │   │   ├── MissingHeadersEditor.jsx  # Row-number input with debounce + Enter + blur + Preview button
│   │   │   └── LoadedImportActions.jsx
│   │   ├── format/            # FormatPanel, MappingRow, FormattedTable
│   │   └── compare/           # CompareSetup, ResultsTable, UnmatchedPanel
│   ├── services/
│   │   ├── importApi.js       # Fetch calls for imports
│   │   ├── formatsApi.js      # Fetch calls for formats CRUD
│   │   └── rowEditsApi.js     # Fetch/save row edit history
│   ├── hooks/
│   │   └── useImportPage.js   # State management for import page
│   └── utils/
│       ├── compareUtils.js    # Matching algorithm + normalization
│       ├── formatUtils.js     # Row building, sort options (no hardcoded formats)
│       ├── exportUtils.js     # CSV + Excel export
│       └── importUtils.js     # Header detection helpers
│
└── CLAUDE.md                  # This file
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `imports` | One row per import session |
| `import_files` | File A/B metadata (name, headers, row count) |
| `import_rows` | All raw rows (JSONB data per row, 500-row batch inserts) |
| `import_mappings` | Saved mappings (panel_key, file_side, format_key, mapping JSONB) |
| `formats` | User-defined formats (key, label, headers JSONB array) |
| `row_edits` | Edit history per matched pair (import_id, pair_id, versions JSONB array) |

All tables are created automatically on backend startup via `initDb()`. QBO and LGL are seeded once via `ON CONFLICT DO NOTHING`. The full schema is also in `backend/migrations/schema.sql` (idempotent — safe to re-run).

**DB connection:** configured in `backend/.env` via `DATABASE_URL`.

---

## Running Locally

Requires a local Postgres instance configured in `backend/.env`:

```
PORT=5020
DATABASE_URL=postgres://app:secret@localhost:5432/accounting
```

Then in two terminals:

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

- Frontend dev server: http://localhost:5173
- Backend API: http://localhost:5020

---

## What's Done

- [x] File upload (CSV + XLSX) with batch Postgres insert
- [x] Missing header detection and rename UI
- [x] *Real headers are in row #* — preview triggers via debounce, Enter, blur, or explicit Preview button; input starts empty
- [x] Dynamic format system — create, edit, delete formats in the UI (stored in DB)
- [x] QBO and LGL auto-seeded on first startup
- [x] Column mapping UI with persistence per import
- [x] Formatted preview with pagination and sorting
- [x] Auto-matching algorithm with field normalization
- [x] Manual pairing of unmatched rows
- [x] CSV export
- [x] Excel export with styling and color coding
- [x] Import session management (list, replace, delete)
- [x] URL-based navigation persistence (refresh-safe on all pages)
- [x] sessionStorage cache for compare page panels
- [x] User Guide page with step-by-step instructions and tips
- [x] Compare page row classification — Truth (no highlight), Conditional Truth (blue), False (red)
- [x] Compare page filter bar — All / Truth / Conditional Truth / False with live counts
- [x] Inline row editing for Conditional Truth and False rows with live re-scoring
- [x] Full edit history per row (original + every edit version) persisted to `row_edits` DB table
- [x] Green highlight for rows corrected to Truth via editing; hover shows complete version history
