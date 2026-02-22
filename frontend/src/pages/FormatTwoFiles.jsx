import { useEffect, useMemo, useState } from "react";

const FORMATS = {
  QBO: {
    label: "QBO format",
    headers: ["Transaction date", "Name", "Line description", "Category", "Account", "Amount"],
  },
  LGL: {
    label: "LGL format",
    headers: ["Gift date", "Name", "Employer/Organization", "Gift category", "Payment Type", "Amount"],
  },
};

function Pager({ page, setPage, totalPages }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
      <div>Page <b>{page}</b> / <b>{totalPages}</b></div>
      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
    </div>
  );
}

function MappingRow({ label, headers, value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 10, alignItems: "center", marginTop: 8 }}>
      <div style={{ fontSize: 14 }}><b>{label}</b></div>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- select source column --</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}

function FormattedTable({ headers, mapping, rows }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => (
            <tr key={r.row_index}>
              {headers.map((h) => {
                const src = mapping?.[h];
                const v = src ? r?.data?.[src] : "";
                return (
                  <td key={h} style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                    {String(v ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormatPanel({ title, importMeta, defaultFileSide, defaultFormatKey }) {
  const [fileSide, setFileSide] = useState(defaultFileSide);
  const [formatKey, setFormatKey] = useState(defaultFormatKey);
  const [mapping, setMapping] = useState({});
  const [confirmed, setConfirmed] = useState(false); // ✅ only show after clicking Show

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(200);
  const [rowsResp, setRowsResp] = useState(null);
  const [err, setErr] = useState("");

  const file = fileSide === "A" ? importMeta?.fileA : importMeta?.fileB;
  const sourceHeaders = file?.headers || [];
  const formatHeaders = FORMATS[formatKey]?.headers || [];

  const totalPages = useMemo(() => {
    const total = file?.rowCount || 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [file?.rowCount, limit]);

  // reset when changing selections
  useEffect(() => {
    setMapping({});
    setConfirmed(false);
    setRowsResp(null);
    setErr("");
    setPage(1);
  }, [fileSide, formatKey]);

  const canShow = formatHeaders.length > 0 && formatHeaders.every((h) => mapping?.[h]);

  const doShow = () => {
    if (!canShow) return;
    setConfirmed(true);
    setPage(1);
  };

  // fetch rows only after confirmed
  useEffect(() => {
    if (!confirmed) return;
    if (!file?.fileId) return;

    const run = async () => {
      setErr("");
      try {
        const r = await fetch(`/api/import/file/${file.fileId}/rows?page=${page}&limit=${limit}`);
        const text = await r.text();
        const data = text ? JSON.parse(text) : null;
        if (!r.ok) throw new Error(data?.error || "Failed to load rows");
        setRowsResp(data);
      } catch (e) {
        setErr(String(e.message || e));
      }
    };

    run();
  }, [confirmed, file?.fileId, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{confirmed ? "Showing" : "Not showing yet"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>Select uploaded file</div>
          <select value={fileSide} onChange={(e) => setFileSide(e.target.value)}>
            <option value="A">File A — {importMeta?.fileA?.name}</option>
            <option value="B">File B — {importMeta?.fileB?.name}</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>Select target format</div>
          <select value={formatKey} onChange={(e) => setFormatKey(e.target.value)}>
            <option value="QBO">{FORMATS.QBO.label}</option>
            <option value="LGL">{FORMATS.LGL.label}</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
        Map each required field to a column from the uploaded file.
      </div>

      {formatHeaders.map((h) => (
        <MappingRow
          key={h}
          label={h}
          headers={sourceHeaders}
          value={mapping[h]}
          onChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}
        />
      ))}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button
          disabled={!canShow}
          onClick={doShow}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111827",
            background: canShow ? "#111827" : "#e5e7eb",
            color: canShow ? "white" : "#111827",
            cursor: canShow ? "pointer" : "not-allowed",
          }}
        >
          Show
        </button>

        {!canShow && (
          <div style={{ fontSize: 13, color: "#b45309" }}>
            Select all mappings first.
          </div>
        )}

        <label style={{ fontSize: 14, marginLeft: "auto" }}>
          Rows/page:&nbsp;
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={!confirmed}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
      </div>

      {confirmed && (
        <>
          <Pager page={page} setPage={setPage} totalPages={totalPages} />
          {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            <b>{file?.name}</b> → <span>{FORMATS[formatKey]?.label}</span>
          </div>

          <FormattedTable headers={formatHeaders} mapping={mapping} rows={rowsResp?.rows || []} />
        </>
      )}
    </div>
  );
}

export default function FormatTwoFiles({ importMeta, onBack }) {
  if (!importMeta?.fileA?.fileId || !importMeta?.fileB?.fileId) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
        <h2>Format Imported Files</h2>
        <div style={{ color: "crimson", marginTop: 10 }}>
          Missing import metadata. Go back and load/import files first.
        </div>
        <button style={{ marginTop: 12 }} onClick={onBack}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1300, margin: "30px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Format Imported Files</h2>
        <button onClick={onBack} style={{ marginLeft: "auto" }}>Back to Import</button>
      </div>

      <div style={{ opacity: 0.8, marginTop: 6 }}>
        Choose file + format + mappings, then click <b>Show</b>. Two formatted datasets side-by-side.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <FormatPanel
          title="Formatted Output 1"
          importMeta={importMeta}
          defaultFileSide="A"
          defaultFormatKey="QBO"
        />
        <FormatPanel
          title="Formatted Output 2"
          importMeta={importMeta}
          defaultFileSide="B"
          defaultFormatKey="LGL"
        />
      </div>
    </div>
  );
}