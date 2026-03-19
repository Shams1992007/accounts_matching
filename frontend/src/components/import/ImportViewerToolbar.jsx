import "./ImportViewerToolbar.css";

export default function ImportViewerToolbar({
  importMeta,
  activeSide,
  setActiveSide,
  sortField,
  setSortField,
  sortOptions,
  sortDir,
  setSortDir,
  limit,
  setLimit,
}) {
  return (
    <div className="viewerToolbar">
      <button onClick={() => setActiveSide("A")} disabled={activeSide === "A"}>
        View File A ({importMeta.fileA?.rowCount ?? 0})
      </button>

      <button onClick={() => setActiveSide("B")} disabled={activeSide === "B"}>
        View File B ({importMeta.fileB?.rowCount ?? 0})
      </button>

      <label className="toolbarLabel">
        Sort by:&nbsp;
        <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="">-- None --</option>
          {sortOptions.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </label>

      <label className="toolbarLabel">
        Order:&nbsp;
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
          <option value="asc">Small to Big / A to Z</option>
          <option value="desc">Big to Small / Z to A</option>
        </select>
      </label>

      <div className="toolbarRight">
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
  );
}