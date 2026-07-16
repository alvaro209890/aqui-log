export function PaginationBar({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="pagination-bar">
        <span className="muted">{total} registro(s)</span>
      </div>
    );
  }
  return (
    <div className="pagination-bar">
      <span className="muted">
        Pagina {page} de {totalPages} · {total} registro(s)
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="text-button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="text-button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
