import { useEffect, useMemo, useRef, useState } from "react";
import Pager from "../common/Pager";
import MappingRow from "./MappingRow";
import FormattedTable from "./FormattedTable";
import {
  buildFormattedRows,
  compareFormattedRows,
  getFormatSortOptions,
  getSavedPanel,
} from "../../utils/formatUtils";
import { fetchFormats } from "../../services/formatsApi";
import "./FormatPanel.css";

export default function FormatPanel({
  panelKey,
  title,
  importMeta,
  defaultFileSide,
  defaultFormatKey,
  onFormattedChange,
}) {
  const saved = getSavedPanel(importMeta, panelKey);

  const [formats, setFormats] = useState([]);
  const [formatsLoading, setFormatsLoading] = useState(true);

  const [fileSide, setFileSide] = useState(saved?.fileSide || defaultFileSide);
  const [formatKey, setFormatKey] = useState(saved?.formatKey || defaultFormatKey);
  const [mapping, setMapping] = useState(saved?.mapping || {});
  const [confirmed, setConfirmed] = useState(Boolean(saved?.mapping));

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(200);
  const [rowsResp, setRowsResp] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const lastSentRef = useRef("");
  const lastRowsFetchKeyRef = useRef("");

  // Load formats once on mount
  useEffect(() => {
    fetchFormats()
      .then((data) => {
        setFormats(Array.isArray(data) ? data : []);
      })
      .catch(() => setFormats([]))
      .finally(() => setFormatsLoading(false));
  }, []);

  // When formats load, ensure formatKey is valid; fall back to first format
  useEffect(() => {
    if (formatsLoading || formats.length === 0) return;
    const exists = formats.some((f) => f.key === formatKey);
    if (!exists) setFormatKey(formats[0].key);
  }, [formatsLoading, formats, formatKey]);

  useEffect(() => {
    const savedAgain = getSavedPanel(importMeta, panelKey);

    setFileSide(savedAgain?.fileSide || defaultFileSide);
    setFormatKey(savedAgain?.formatKey || defaultFormatKey);
    setMapping(savedAgain?.mapping || {});
    setConfirmed(Boolean(savedAgain?.mapping));
    setPage(1);
    setRowsResp(null);
    setErr("");
    setMsg("");
    lastSentRef.current = "";
    lastRowsFetchKeyRef.current = "";
  }, [
    importMeta?.importId,
    importMeta?.savedMappings,
    panelKey,
    defaultFileSide,
    defaultFormatKey,
  ]);

  const file = fileSide === "A" ? importMeta?.fileA : importMeta?.fileB;
  const sourceHeaders = file?.headers || [];
  const activeFormat = formats.find((f) => f.key === formatKey) || null;
  const formatHeaders = activeFormat?.headers || [];

  const totalPages = useMemo(() => {
    const total = file?.rowCount || 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [file?.rowCount, limit]);

  const canShow = formatHeaders.length > 0 && formatHeaders.every((h) => mapping?.[h]);

  const sortOptions = useMemo(() => {
    return getFormatSortOptions(formatHeaders);
  }, [formatHeaders]);

  useEffect(() => {
    const allowed = new Set(sortOptions.map((x) => x.value));
    if (!allowed.has(sortField)) {
      setSortField(sortOptions[0]?.value || "");
    }
  }, [sortOptions, sortField]);

  const doShow = async () => {
    if (!canShow || !importMeta?.importId) return;

    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const r = await fetch(`/api/import/${importMeta.importId}/mappings/${panelKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSide, formatKey, mapping }),
      });

      const text = await r.text();
      const data = text ? JSON.parse(text) : null;

      if (!r.ok) throw new Error(data?.error || "Failed to save mapping");

      setConfirmed(true);
      setPage(1);
      setMsg("Mapping saved.");
      lastSentRef.current = "";
      lastRowsFetchKeyRef.current = "";
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!confirmed) return;
    if (!file?.fileId) return;

    const fetchKey = `${file.fileId}::${page}::${limit}`;
    if (lastRowsFetchKeyRef.current === fetchKey) return;
    lastRowsFetchKeyRef.current = fetchKey;

    const run = async () => {
      setErr("");
      try {
        const r = await fetch(
          `/api/import/file/${file.fileId}/rows?page=${page}&limit=${limit}`
        );
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

  const formattedRows = useMemo(() => {
    const arr = buildFormattedRows(rowsResp?.rows || [], mapping, formatHeaders);

    if (!sortField) return arr;

    const copy = [...arr];
    copy.sort((a, b) => {
      const cmp = compareFormattedRows(a, b, sortField);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return copy;
  }, [rowsResp?.rows, mapping, formatHeaders, sortField, sortDir]);

  useEffect(() => {
    if (!confirmed) return;
    if (!formattedRows?.length) return;
    if (!onFormattedChange) return;

    const payload = {
      panelKey,
      title,
      fileSide,
      formatKey,
      fileName: file?.name || "",
      headers: formatHeaders,
      rows: formattedRows,
      mapping,
    };

    const signature = JSON.stringify({
      panelKey,
      title,
      fileSide,
      formatKey,
      fileName: file?.name || "",
      headers: formatHeaders,
      mapping,
      rowCount: formattedRows.length,
      firstRowKey: formattedRows[0]?.__rowKey ?? null,
      lastRowKey: formattedRows[formattedRows.length - 1]?.__rowKey ?? null,
      sortField,
      sortDir,
      page,
      limit,
    });

    if (lastSentRef.current === signature) return;
    lastSentRef.current = signature;
    onFormattedChange(panelKey, payload);
  }, [
    confirmed,
    formattedRows,
    panelKey,
    title,
    fileSide,
    formatKey,
    file?.name,
    formatHeaders,
    mapping,
    onFormattedChange,
    sortField,
    sortDir,
    page,
    limit,
  ]);

  if (formatsLoading) {
    return <div className="formatPanel"><div className="formatPanelLoading">Loading formats…</div></div>;
  }

  return (
    <div className="formatPanel">
      <div className="formatPanelHead">
        <h3>{title}</h3>
        <div className="formatPanelStatus">
          {confirmed ? "Using saved mapping" : "Not saved yet"}
        </div>
      </div>

      <div className="formatPanelGrid">
        <div>
          <div className="formatPanelLabel">Select uploaded file</div>
          <select
            value={fileSide}
            onChange={(e) => {
              setFileSide(e.target.value);
              setConfirmed(false);
              setRowsResp(null);
              setPage(1);
              setMsg("");
              setErr("");
              lastSentRef.current = "";
              lastRowsFetchKeyRef.current = "";
            }}
          >
            <option value="A">File A — {importMeta?.fileA?.name}</option>
            <option value="B">File B — {importMeta?.fileB?.name}</option>
          </select>
        </div>

        <div>
          <div className="formatPanelLabel">Select target format</div>
          <select
            value={formatKey}
            onChange={(e) => {
              setFormatKey(e.target.value);
              setMapping({});
              setConfirmed(false);
              setRowsResp(null);
              setPage(1);
              setMsg("");
              setErr("");
              lastSentRef.current = "";
              lastRowsFetchKeyRef.current = "";
            }}
          >
            {formats.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="formatPanelSub">
        Map once, save, and it will be reused for this import unless changed.
      </div>

      {formatHeaders.map((h) => (
        <MappingRow
          key={h}
          label={h}
          headers={sourceHeaders}
          value={mapping[h]}
          onChange={(v) => {
            setMapping((m) => ({ ...m, [h]: v }));
            setConfirmed(false);
            setMsg("");
            setErr("");
            lastSentRef.current = "";
          }}
        />
      ))}

      <div className="formatPanelActions">
        <button
          disabled={!canShow || saving}
          onClick={doShow}
          className={`formatPrimaryBtn ${!canShow ? "formatPrimaryBtnDisabled" : ""}`}
        >
          {saving ? "Saving..." : confirmed ? "Save Changes & Show" : "Save & Show"}
        </button>

        {!canShow && <div className="formatWarn">Select all mappings first.</div>}

        <label className="formatRowsPage">
          Rows/page:&nbsp;
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
              lastRowsFetchKeyRef.current = "";
              lastSentRef.current = "";
            }}
            disabled={!confirmed}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
      </div>

      {msg && <div className="formatOk">{msg}</div>}
      {err && <div className="formatErr">{err}</div>}

      {confirmed && (
        <>
          <div className="formatSortRow">
            <label>
              Sort by:&nbsp;
              <select
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value);
                  lastSentRef.current = "";
                }}
              >
                <option value="">-- None --</option>
                {sortOptions.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Order:&nbsp;
              <select
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value);
                  lastSentRef.current = "";
                }}
              >
                <option value="asc">Small to Big / A to Z</option>
                <option value="desc">Big to Small / Z to A</option>
              </select>
            </label>
          </div>

          <Pager page={page} setPage={setPage} totalPages={totalPages} />

          <div className="formatFileInfo">
            <b>{file?.name}</b> → <span>{activeFormat?.label}</span>
          </div>

          <FormattedTable headers={formatHeaders} rows={formattedRows} />
        </>
      )}
    </div>
  );
}
