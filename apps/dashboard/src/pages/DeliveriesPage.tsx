import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type DeliveryRecord } from '../api';
import { PaginationBar } from '../components/PaginationBar';
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [courierId, setCourierId] = useState('');

  const load = (p = page) => {
    setLoading(true);
    api
      .deliveries(token, {
        status: status || undefined,
        company: company || undefined,
        courier: courier || undefined,
        date: date || undefined,
        page: p,
        limit: 20,
      })
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
      toast.error(err instanceof Error ? err.message : 'Falha na acao');
    }
  };

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>OPERACAO</p>
          <h1>Entregas</h1>
          <span>Filtre, despache, atribua e cancele entregas.</span>
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
        <button
          className="primary-button"
          type="button"
          onClick={() => load(1)}
        >
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
                  <th>ACOES</th>
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
                    <td className="row-actions">
                      {item.status === 'REQUESTED' && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            act('Despachado', () =>
                              api.dispatchDelivery(token, item.id),
                            )
                          }
                        >
                          Despachar
                        </button>
                      )}
                      {['REQUESTED', 'OFFERED', 'ACCEPTED', 'AT_PICKUP'].includes(
                        item.status,
                      ) && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            setAssignId(item.id);
                            setCourierId('');
                          }}
                        >
                          Assign
                        </button>
                      )}
                      {!['DELIVERED', 'CANCELED'].includes(item.status) && (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() =>
                            act('Cancelada', () =>
                              api.cancelDelivery(token, item.id),
                            )
                          }
                        >
                          Cancelar
                        </button>
                      )}
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
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={(p) => load(p)}
        />
      </section>

      {assignId && (
        <div className="modal-scrim">
          <div className="modal panel">
            <h3>Atribuir entregador</h3>
            <label>
              Courier ID
              <input
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                placeholder="UUID do courier"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => setAssignId(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!courierId}
                onClick={async () => {
                  await act('Atribuido', () =>
                    api.assignDelivery(token, assignId, courierId),
                  );
                  setAssignId(null);
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
