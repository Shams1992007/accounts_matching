import DataTable from "../common/DataTable";
import "./FormattedTable.css";

export default function FormattedTable({ headers, rows, scrollRef, hideScrollbar }) {
  return (
    <DataTable
      headers={headers}
      rows={rows}
      scrollRef={scrollRef}
      hideScrollbar={hideScrollbar}
    />
  );
}