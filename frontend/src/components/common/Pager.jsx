import "./Pager.css";

export default function Pager({ page, setPage, totalPages }) {
  return (
    <div className="pager">
      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
        Prev
      </button>

      <div>
        Page <b>{page}</b> / <b>{totalPages}</b>
      </div>

      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
        Next
      </button>
    </div>
  );
}