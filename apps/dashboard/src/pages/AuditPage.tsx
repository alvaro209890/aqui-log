import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type AuditRecord } from '../api';
import { PaginationBar } from '../components/PaginationBar';

export function AuditPage({ token }: { token: string }) {
  const [items, setItems] = useState<AuditRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = (p = page) => {
    setLoading(true);
    api
      .audit(token, p, 50)
      .then((res) => {
        setItems(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>GESTAO</p>
          <h1>Auditoria</h1>
          <span>Trilha de acoes administrativas e operacionais.</span>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-line" />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>QUANDO</th>
                  <th>ACAO</th>
                  <th>RECURSO</th>
                  <th>ATOR</th>
                  <th>META</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <strong>{row.action}</strong>
                    </td>
                    <td>
                      {row.resourceType}
                      {row.resourceId
                        ? ` #${row.resourceId.slice(0, 8)}`
                        : ''}
                    </td>
                    <td>{row.actorId?.slice(0, 8) ?? 'sistema'}</td>
                    <td className="muted">
                      {Object.keys(row.metadata ?? {}).length
                        ? JSON.stringify(row.metadata)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !items.length && (
            <p className="empty-state">Nenhum evento de auditoria.</p>
          )}
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={(p) => load(p)}
        />
      </section>
    </div>
  );
}
