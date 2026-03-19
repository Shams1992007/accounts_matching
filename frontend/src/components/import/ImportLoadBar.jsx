import "./ImportLoadBar.css";

export default function ImportLoadBar({
  importsList,
  selectedImportId,
  setSelectedImportId,
  onLoad,
  onRefresh,
  canGoFormat,
  onGoFormat,
  hasMissingHeaders,
}) {
  return (
    <div className="boxCard">
      <b>Load Existing Import</b>

      <div className="loadBarRow">
        <select
          value={selectedImportId}
          onChange={(e) => setSelectedImportId(e.target.value)}
          className="loadSelect"
        >
          <option value="">-- Select Import --</option>
          {importsList.map((x) => (
            <option key={x.import_id} value={String(x.import_id)}>
              Import #{x.import_id} — {x.file_a_name} / {x.file_b_name}
            </option>
          ))}
        </select>

        <button disabled={!selectedImportId} onClick={onLoad}>
          Load
        </button>

        <button onClick={onRefresh}>Refresh List</button>

        {canGoFormat && (
          <button
            disabled={hasMissingHeaders}
            onClick={onGoFormat}
            className={`darkBtn ${hasMissingHeaders ? "disabledBtn" : ""}`}
          >
            Go to Format Page
          </button>
        )}
      </div>

      {hasMissingHeaders && (
        <div className="warnText">
          You must fill all missing headers before going to Format.
        </div>
      )}
    </div>
  );
}