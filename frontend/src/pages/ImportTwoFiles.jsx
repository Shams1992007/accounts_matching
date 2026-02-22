import { useEffect, useMemo, useState } from "react";

function Pager({ page, setPage, totalPages }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <div>Page <b>{page}</b> / <b>{totalPages}</b></div>
      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
    </div>
  );
}

function RowsTable({ headers, rows }) {
  if (!headers?.length) return <div style={{ marginTop: 10, opacity: 0.7 }}>No headers</div>;

  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row_index}>
              {headers.map((h) => (
                <td key={h} style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                  {String(r?.data?.[h] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Props:
 * - importMeta (optional)
 * - onImported(meta)
 * - onGoFormat()
 */
export default function ImportTwoFiles({ importMeta: importMetaProp, onImported, onGoFormat }) {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [importMetaLocal, setImportMetaLocal] = useState(null);
  const importMeta = importMetaProp || importMetaLocal;

  const [importsList, setImportsList] = useState([]);
  const [selectedImportId, setSelectedImportId] = useState("");

  const [activeSide, setActiveSide] = useState("A");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(200);

  const activeFile = activeSide === "A" ? importMeta?.fileA : importMeta?.fileB;

  const totalPages = useMemo(() => {
    const total = activeFile?.rowCount || 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [activeFile?.rowCount, limit]);

  const [rowsResp, setRowsResp] = useState(null);

  // load recent imports list
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch("/api/import/list");
        const data = await r.json();
        if (r.ok) setImportsList(Array.isArray(data) ? data : []);
      } catch (_) {}
    };
    run();
  }, []);

  const loadImportMeta = async (importId) => {
    setErr("");
    setRowsResp(null);
    setActiveSide("A");
    setPage(1);

    try {
      const r = await fetch(`/api/import/${importId}`);
      const text = await r.text();
      const data = text ? JSON.parse(text) : null;
      if (!r.ok) throw new Error(data?.error || "Failed to load import");
      setImportMetaLocal(data);
      onImported?.(data);
    } catch (e) {
      setErr(String(e.message || e));
    }
  };

  const createImport = async () => {
    setErr("");
    setImportMetaLocal(null);
    setRowsResp(null);

    if (!fileA || !fileB) {
      setErr("Please select BOTH files.");
      return;
    }

    const fd = new FormData();
    fd.append("fileA", fileA);
    fd.append("fileB", fileB);

    setLoading(true);
    try {
      const r = await fetch("/api/import/create", { method: "POST", body: fd });
      const text = await r.text();
      const data = text ? JSON.parse(text) : null;

      if (!r.ok) throw new Error(data?.error || "Import failed");

      setImportMetaLocal(data);
      onImported?.(data);

      setActiveSide("A");
      setPage(1);
      setSelectedImportId(String(data.importId));

      // refresh list so the new import appears
      try {
        const rr = await fetch("/api/import/list");
        const dd = await rr.json();
        if (rr.ok) setImportsList(Array.isArray(dd) ? dd : []);
      } catch (_) {}
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  // fetch rows for active file
  useEffect(() => {
    if (!activeFile?.fileId) return;

    const run = async () => {
      setErr("");
      try {
        const r = await fetch(`/api/import/file/${activeFile.fileId}/rows?page=${page}&limit=${limit}`);
        const text = await r.text();
        const data = text ? JSON.parse(text) : null;
        if (!r.ok) throw new Error(data?.error || "Failed to load rows");
        setRowsResp(data);
      } catch (e) {
        setErr(String(e.message || e));
      }
    };

    run();
  }, [activeFile?.fileId, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
      <h2 style={{ marginBottom: 6 }}>Import Two Files (Paginated)</h2>
      <div style={{ opacity: 0.8, marginBottom: 18 }}>
        Upload CSV/Excel OR load an existing import from DB.
      </div>

      {/* Load existing import */}
      <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <b>Load Existing Import</b>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedImportId}
            onChange={(e) => setSelectedImportId(e.target.value)}
            style={{ minWidth: 420 }}
          >
            <option value="">-- Select Import --</option>
            {importsList.map((x) => (
              <option key={x.import_id} value={String(x.import_id)}>
                Import #{x.import_id} — {x.file_a_name} / {x.file_b_name}
              </option>
            ))}
          </select>

          <button
            disabled={!selectedImportId}
            onClick={() => loadImportMeta(selectedImportId)}
          >
            Load
          </button>

          {importMeta && (
            <button
              onClick={() => onGoFormat?.()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                cursor: "pointer",
              }}
            >
              Go to Format Page
            </button>
          )}
        </div>
      </div>

      {/* Upload new */}
      {!importMeta && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 10 }}>
              <b>File A</b>
              <input
                style={{ display: "block", marginTop: 10 }}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFileA(e.target.files?.[0] || null)}
              />
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{fileA ? fileA.name : "No file selected"}</div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 10 }}>
              <b>File B</b>
              <input
                style={{ display: "block", marginTop: 10 }}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFileB(e.target.files?.[0] || null)}
              />
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{fileB ? fileB.name : "No file selected"}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={createImport} disabled={loading}>
              {loading ? "Importing..." : "Import & Save to DB"}
            </button>
            {err && <div style={{ color: "crimson" }}>{err}</div>}
          </div>
        </>
      )}

      {/* Viewer */}
      {importMeta && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div><b>Import ID:</b> {importMeta.importId}</div>

            <button onClick={() => { setActiveSide("A"); setPage(1); }} disabled={activeSide === "A"}>
              View File A ({importMeta.fileA?.rowCount ?? 0})
            </button>
            <button onClick={() => { setActiveSide("B"); setPage(1); }} disabled={activeSide === "B"}>
              View File B ({importMeta.fileB?.rowCount ?? 0})
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <label>
                Rows/page:&nbsp;
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </label>
            </div>
          </div>

          {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

          <Pager page={page} setPage={setPage} totalPages={totalPages} />

          <div style={{ marginTop: 10, opacity: 0.8 }}>
            <b>{activeSide === "A" ? importMeta.fileA?.name : importMeta.fileB?.name}</b>
          </div>

          <RowsTable headers={activeFile?.headers || []} rows={rowsResp?.rows || []} />
        </div>
      )}
    </div>
  );
}