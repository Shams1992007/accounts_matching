import DataTable from "../common/DataTable";
import "./FormattedTable.css";

export default function FormattedTable({ headers, rows }) {
  return <DataTable headers={headers} rows={rows} />;
}