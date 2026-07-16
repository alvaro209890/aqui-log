import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type DeliveryRecord } from '../api';
import { StatusBadge } from '../components/StatusBadge';

const statuses = [
  '',
  'REQUESTED',
  'OFFERED',
  'ACCEPTED',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELED',
];

export function DeliveriesPage({ token }: { token: string }) {
  const [items, setItems] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [courier, setCourier] = useState('');
  const [date, setDate] = useState('');

  const load = () => {
    setLoading(true);
    api
      .deliveries(token, {
        status: status || undefined,
        company: company || undefined,
        courier: courier || undefined,
        date: date || undefined,
      })
      .then(setItems)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>OPERACAO</p>
          <h1>Entregas</h1>
          <span>Filtre e acompanhe todas as entregas da plataforma.</span>
        </div>
      </section>

      <div className="filters-bar panel">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'Todos'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Empresa (ID)
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="UUID da empresa"
          />
        </label>
        <label>
          Entregador (ID)
          <input
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="UUID do entregador"
          />
        </label>
        <label>
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={load}>
          Aplicar filtros
        </button>
      </div>

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
                  <th>CODIGO</th>
                  <th>COLETA</th>
                  <th>ENTREGA</th>
                  <th>EMPRESA</th>
                  <th>ENTREGADOR</th>
                  <th>STATUS</th>
                  <th>CRIADA</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>{item.pickupAddress}</td>
                    <td>{item.deliveryAddress}</td>
                    <td>{item.companyId?.slice(0, 8) ?? '—'}</td>
                    <td>{item.courierId?.slice(0, 8) ?? '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !items.length && (
            <p className="empty-state">Nenhuma entrega com esses filtros.</p>
          )}
        </div>
      </section>
    </div>
  );
}
