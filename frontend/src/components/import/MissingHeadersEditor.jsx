import { useEffect, useState } from "react";
import { getMissingHeaders } from "../../utils/importUtils";
import { fetchFileRows } from "../../services/importApi";
import "./MissingHeadersEditor.css";

export default function MissingHeadersEditor({
  title,
  file,
  values,
  setValues,
  skipRows,
  setSkipRows,
  applying,
  onApplySkipRows,
}) {
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState("");
  const [rawInput, setRawInput] = useState(String(skipRows));

  const missing = getMissingHeaders(file?.headers || []);

  useEffect(() => {
    if (!file?.fileId || !missing.length) return;
    setPreview(null);
    setPreviewErr("");

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // fetch the row at index (skipRows - 1) using page trick: page=skipRows, limit=1
        const resp = await fetchFileRows(file.fileId, skipRows, 1);
        if (cancelled) return;
        const row = resp.rows?.[0];
        if (!row) {
          setPreviewErr("No row at this position — value too large.");
          return;
        }
        // The values in this row ARE the new header names
        const currentHeaders = file.headers || [];
        const newHeaders = currentHeaders.map((h) => {
          const val = String(row.data?.[h] ?? "").trim();
          return val || h;
        });
        setPreview(newHeaders);
      } catch {
        if (!cancelled) setPreviewErr("Could not preview.");
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [file?.fileId, skipRows, missing.length]);

  if (!file || !missing.length) return null;

  return (
    <div className="missingHeadersBox">
      <b>{title}</b>

      <div className="missingHeadersSub">
        The file has junk rows before the real column headers. Look at the table below, find which row contains the real headers, and enter that row number.
      </div>

      <div className="skipRowsRow">
        <label className="skipRowsLabel">
          Real headers are in row #:
          <input
            className="skipRowsInput"
            type="number"
            min="1"
            max="100"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={() => {
              const n = Math.max(1, parseInt(rawInput, 10) || 1);
              setRawInput(String(n));
              setSkipRows(n);
            }}
          />
        </label>
        <button onClick={onApplySkipRows} disabled={applying}>
          {applying ? "Loading..." : "Load Now"}
        </button>
      </div>

      {previewErr && <div className="skipRowsPreviewErr">{previewErr}</div>}
      {preview && !previewErr && (
        <div className="skipRowsPreview">
          <span className="skipRowsPreviewLabel">Preview headers:</span>{" "}
          {preview.join(" | ")}
        </div>
      )}

      <div className="missingHeadersGrid">
        {missing.map((oldKey, idx) => (
          <div key={`${oldKey}-${idx}`} className="missingHeaderRow">
            <div className="missingHeaderLabel">Missing header #{idx + 1}</div>

            <input
              type="text"
              value={values[oldKey] || ""}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [oldKey]: e.target.value,
                }))
              }
              placeholder="Enter header name"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
