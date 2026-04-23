import FileUploadCard from "./FileUploadCard";
import MissingHeadersEditor from "./MissingHeadersEditor";
import "./LoadedImportActions.css";

export default function LoadedImportActions({
  importMeta,
  headerInputsA,
  setHeaderInputsA,
  headerInputsB,
  setHeaderInputsB,
  hasMissingHeaders,
  savingHeaders,
  onSaveMissingHeaders,
  replaceFileA,
  setReplaceFileA,
  replaceFileB,
  setReplaceFileB,
  replacing,
  onReplace,
  deleting,
  onDelete,
  skipRowsA,
  setSkipRowsA,
  skipRowsB,
  setSkipRowsB,
  applyingSkipRowsA,
  applyingSkipRowsB,
  onApplySkipRowsA,
  onApplySkipRowsB,
}) {
  const missingA = (importMeta.fileA?.headers || []).some((h) => /^__EMPTY/i.test(h) || !String(h).trim());
  const missingB = (importMeta.fileB?.headers || []).some((h) => /^__EMPTY/i.test(h) || !String(h).trim());

  return (
    <div className="boxCard">
      <b>Loaded Import Actions</b>

      <div className="importInfo">
        <div><b>Import ID:</b> {importMeta.importId}</div>
        <div><b>File A:</b> {importMeta.fileA?.name} ({importMeta.fileA?.rowCount ?? 0} rows)</div>
        <div><b>File B:</b> {importMeta.fileB?.name} ({importMeta.fileB?.rowCount ?? 0} rows)</div>
      </div>

      <MissingHeadersEditor
        title="Fix Missing Headers - File A"
        file={importMeta.fileA}
        values={headerInputsA}
        setValues={setHeaderInputsA}
        skipRows={skipRowsA}
        setSkipRows={setSkipRowsA}
        applying={applyingSkipRowsA}
        onApplySkipRows={onApplySkipRowsA}
      />

      <MissingHeadersEditor
        title="Fix Missing Headers - File B"
        file={importMeta.fileB}
        values={headerInputsB}
        setValues={setHeaderInputsB}
        skipRows={skipRowsB}
        setSkipRows={setSkipRowsB}
        applying={applyingSkipRowsB}
        onApplySkipRows={onApplySkipRowsB}
      />

      {hasMissingHeaders && (
        <div className="saveHeadersWrap">
          <button onClick={onSaveMissingHeaders} disabled={savingHeaders}>
            {savingHeaders ? "Saving Headers..." : "Save Missing Headers"}
          </button>
        </div>
      )}

      <div className="replaceGrid">
        <FileUploadCard title="Replace File A" file={replaceFileA} onChange={setReplaceFileA} />
        <FileUploadCard title="Replace File B" file={replaceFileB} onChange={setReplaceFileB} />
      </div>

      <div className="actionRow">
        <button onClick={onReplace} disabled={replacing}>
          {replacing ? "Replacing..." : "Replace Both Files"}
        </button>

        <button onClick={onDelete} disabled={deleting} className="dangerBtn">
          {deleting ? "Deleting..." : "Delete This Import"}
        </button>
      </div>
    </div>
  );
}
