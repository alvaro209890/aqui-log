import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type UserRecord } from '../api';
import { PaginationBar } from '../components/PaginationBar';
import { StatusBadge } from '../components/StatusBadge';

export function UsersPage({ token }: { token: string }) {
  const [items, setItems] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = (p = page) => {
    setLoading(true);
    api
      .users(token, p, 20)
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
          <h1>Usuarios</h1>
          <span>Contas da plataforma (sem hash de senha).</span>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-line" />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>E-MAIL</th>
                  <th>PAPEL</th>
                  <th>STATUS</th>
                  <th>EMPRESA</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td>{u.companyId?.slice(0, 8) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !items.length && (
            <p className="empty-state">Nenhum usuario.</p>
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
