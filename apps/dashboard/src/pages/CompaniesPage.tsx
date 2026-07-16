import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type CompanyRecord } from '../api';
import { StatusBadge } from '../components/StatusBadge';

export function CompaniesPage({ token }: { token: string }) {
  const [items, setItems] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .companies(token)
      .then(setItems)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const approve = async (id: string) => {
    try {
      await api.approveCompany(token, id);
      toast.success('Empresa aprovada');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aprovar');
    }
  };

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>CADASTROS</p>
          <h1>Empresas</h1>
          <span>Aprove e acompanhe empresas parceiras.</span>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.tradeName ?? item.legalName ?? item.id}</strong>
                      <div className="muted">{item.legalName}</div>
                    </td>
                    <td>{item.document ?? '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {item.status === 'PENDING' && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => approve(item.id)}
                        >
                          Aprovar
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
      </section>
    </div>
  );
}
