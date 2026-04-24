import { useEffect, useRef, useState } from "react";
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
  const [rawInput, setRawInput] = useState("");
  const cancelRef = useRef(null);

  const missing = getMissingHeaders(file?.headers || []);

  const runPreview = async (n) => {
    if (!file?.fileId || !missing.length) return;
    if (cancelRef.current) cancelRef.current();

    setPreview(null);
    setPreviewErr("");

    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    try {
      const resp = await fetchFileRows(file.fileId, n, 1);
      if (cancelled) return;
      const row = resp.rows?.[0];
      if (!row) {
        setPreviewErr("No row at this position — value too large.");
        return;
      }
      const newHeaders = (file.headers || []).map((h) => {
        const val = String(row.data?.[h] ?? "").trim();
        return val || h;
      });
      setPreview(newHeaders);
    } catch {
      if (!cancelled) setPreviewErr("Could not preview.");
    }
  };

  const commitValue = (raw) => {
    const n = parseInt(raw, 10);
    if (!raw.trim() || isNaN(n) || n < 1) return;
    setSkipRows(n);
    runPreview(n);
  };

  // Option 1 — debounce: auto-preview 500ms after user stops typing
  useEffect(() => {
    if (!rawInput.trim()) return;
    const timer = setTimeout(() => commitValue(rawInput), 500);
    return () => clearTimeout(timer);
  }, [rawInput]);

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
            placeholder="e.g. 2"
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={() => commitValue(rawInput)}
            onKeyDown={(e) => e.key === "Enter" && commitValue(rawInput)}
          />
        </label>
        <button
          className="previewBtn"
          onClick={() => commitValue(rawInput)}
          disabled={!rawInput.trim()}
        >
          Preview
        </button>
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
