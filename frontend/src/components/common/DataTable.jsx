import "./DataTable.css";

export default function DataTable({
  headers = [],
  rows = [],
  getValue,
  renderHeader,
  emptyText = "No headers",
}) {
  if (!headers.length) return <div className="tableEmpty">{emptyText}</div>;

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{renderHeader ? renderHeader(h) : h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.__rowKey ?? r.row_index ?? idx}>
              {headers.map((h) => (
                <td key={h}>{String(getValue ? getValue(r, h) : r?.[h] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}