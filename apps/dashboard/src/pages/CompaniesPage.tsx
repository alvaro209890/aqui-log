import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type CompanyRecord } from '../api';
import { PaginationBar } from '../components/PaginationBar';
import { StatusBadge } from '../components/StatusBadge';

export function CompaniesPage({ token }: { token: string }) {
  const [items, setItems] = useState<CompanyRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = (p = page) => {
    setLoading(true);
    api
      .companies(token, p, 20)
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

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    }
  };

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>CADASTROS</p>
          <h1>Empresas</h1>
          <span>Aprovar, recusar ou suspender empresas parceiras.</span>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-line" />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>DOCUMENTO</th>
                  <th>STATUS</th>
                  <th>ACOES</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.tradeName ?? item.legalName ?? item.id}
                      </strong>
                      <div className="muted">{item.legalName}</div>
                    </td>
                    <td>{item.document ?? '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="row-actions">
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              act('Empresa aprovada', () =>
                                api.approveCompany(token, item.id),
                              )
                            }
                          >
                            Aprovar
                          </button>
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() =>
                              act('Empresa recusada', () =>
                                api.rejectCompany(token, item.id),
                              )
                            }
                          >
                            Recusar
                          </button>
                        </>
                      )}
                      {item.status === 'ACTIVE' && (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() =>
                            act('Empresa suspensa', () =>
                              api.suspendCompany(token, item.id),
                            )
                          }
                        >
                          Suspender
                        </button>
                      )}
                      {item.status === 'SUSPENDED' && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            act('Empresa reativada', () =>
                              api.approveCompany(token, item.id),
                            )
                          }
                        >
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !items.length && (
            <p className="empty-state">Nenhuma empresa cadastrada.</p>
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
