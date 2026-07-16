import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type CourierRecord } from '../api';
import { StatusBadge } from '../components/StatusBadge';

export function CouriersPage({ token }: { token: string }) {
  const [items, setItems] = useState<CourierRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .couriers(token)
      .then(setItems)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const approve = async (id: string) => {
    try {
      await api.approveCourier(token, id);
      toast.success('Entregador aprovado');
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
          <h1>Entregadores</h1>
          <span>Disponibilidade, veiculos e aprovacoes.</span>
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
                  <th>ID</th>
                  <th>VEICULO</th>
                  <th>PLACA</th>
                  <th>STATUS</th>
                  <th>DISPONIVEL</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>#{item.id.slice(0, 8)}</strong>
                    </td>
                    <td>{item.vehicleType ?? '—'}</td>
                    <td>{item.vehiclePlate ?? '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.available ? 'Sim' : 'Nao'}</td>
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
            <p className="empty-state">Nenhum entregador cadastrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
