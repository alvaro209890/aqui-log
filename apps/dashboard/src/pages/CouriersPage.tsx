import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type CourierRecord } from '../api';
import { PaginationBar } from '../components/PaginationBar';
import { StatusBadge } from '../components/StatusBadge';

const vehicleLabel: Record<string, string> = {
  MOTORCYCLE: 'Moto',
  BICYCLE: 'Bicicleta',
  CAR: 'Carro',
  VAN: 'Van',
};

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'SUSPENDED', label: 'Suspensos' },
  { value: 'REJECTED', label: 'Rejeitados' },
];

/** CPF com pontuação — o operador confere contra o documento enviado. */
function formatDocument(value?: string) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '—';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Há quanto tempo o cadastro espera — é o que dá urgência à fila. */
function waitingFor(value?: string) {
  if (!value) return '';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const horas = Math.floor(ms / 3_600_000);
  if (horas < 1) return 'há menos de 1 h';
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias > 1 ? 's' : ''}`;
}

type PendingAction = { courier: CourierRecord; kind: 'approve' | 'reject' };

export function CouriersPage({ token }: { token: string }) {
  const [items, setItems] = useState<CourierRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ADMIN-02A: a fila de aprovação é carregada separada da lista geral. Sem
  // isso, um cadastro novo entra no fim de uma lista paginada de dezenas de
  // entregadores e ninguém repara que alguém está esperando.
  const [queue, setQueue] = useState<CourierRecord[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingAction | null>(null);
  const [acting, setActing] = useState(false);

  const loadQueue = useCallback(() => {
    setQueueLoading(true);
    setQueueError(null);
    api
      .couriers(token, 1, 50, 'PENDING')
      .then((res) => setQueue(res.items))
      .catch((err: Error) => {
        setQueueError(err.message);
        setQueue([]);
      })
      .finally(() => setQueueLoading(false));
  }, [token]);

  const loadList = useCallback(
    (p = 1, st = status) => {
      setLoading(true);
      setError(null);
      api
        .couriers(token, p, 20, st || undefined)
        .then((res) => {
          setItems(res.items);
          setPage(res.page);
          setTotalPages(res.totalPages);
          setTotal(res.total);
        })
        .catch((err: Error) => {
          setError(err.message);
          setItems([]);
        })
        .finally(() => setLoading(false));
    },
    [token, status],
  );

  useEffect(() => {
    loadQueue();
    loadList(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      loadQueue();
      loadList(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    }
  };

  const confirmar = async () => {
    if (!confirming) return;
    const { courier, kind } = confirming;
    const quem = courier.name || `#${courier.id.slice(0, 8)}`;
    setActing(true);
    try {
      if (kind === 'approve') {
        await api.approveCourier(token, courier.id);
        toast.success(`${quem} aprovado. Já pode ficar disponível.`);
      } else {
        await api.rejectCourier(token, courier.id);
        toast.success(`${quem} recusado.`);
      }
      setConfirming(null);
      loadQueue();
      loadList(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>CADASTROS</p>
          <h1>Entregadores</h1>
          <span>Fila de aprovação, disponibilidade e veículos.</span>
        </div>
        {!queueLoading && queue.length > 0 && (
          <span className="status amber">
            <i />
            {queue.length} aguardando aprovação
          </span>
        )}
      </section>

      {/* Fila de aprovação (ADMIN-02A) */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Fila de aprovação</h2>
            <p>
              Confira os dados antes de liberar. Sem aprovação, o entregador não
              entra no app nem recebe ofertas.
            </p>
          </div>
        </div>
        {queueLoading ? (
          <div className="skeleton-table">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : queueError ? (
          <p className="empty-state">
            Não foi possível carregar a fila: {queueError}{' '}
            <button className="text-button" type="button" onClick={loadQueue}>
              Tentar de novo
            </button>
          </p>
        ) : queue.length === 0 ? (
          <p className="empty-state">
            Nenhum cadastro aguardando aprovação.
          </p>
        ) : (
          <div className="approval-queue">
            {queue.map((c) => (
              <article key={c.id} className="approval-card">
                <div className="approval-identity">
                  <strong>{c.name || `#${c.id.slice(0, 8)}`}</strong>
                  <span>{c.email || 'sem e-mail'}</span>
                </div>
                <dl className="approval-facts">
                  <div>
                    <dt>CPF</dt>
                    <dd>{formatDocument(c.document)}</dd>
                  </div>
                  <div>
                    <dt>Veículo</dt>
                    <dd>
                      {vehicleLabel[c.vehicleType ?? ''] ??
                        c.vehicleType ??
                        '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Placa</dt>
                    <dd>{c.vehiclePlate || '—'}</dd>
                  </div>
                  <div>
                    <dt>Cadastrou-se</dt>
                    <dd>
                      {formatDate(c.createdAt)}{' '}
                      <em>{waitingFor(c.createdAt)}</em>
                    </dd>
                  </div>
                </dl>
                <div className="approval-docs">
                  <span>Documentos</span>
                  {c.documentUrls && c.documentUrls.length > 0 ? (
                    <ul>
                      {c.documentUrls.map((url, i) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Documento {i + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Nenhum documento enviado.</p>
                  )}
                </div>
                <div className="approval-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      setConfirming({ courier: c, kind: 'approve' })
                    }
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      setConfirming({ courier: c, kind: 'reject' })
                    }
                  >
                    Recusar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Lista completa */}
      <div className="filters-bar panel">
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              loadList(1, e.target.value);
            }}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="panel">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-line" />
              ))}
            </div>
          ) : error ? (
            <p className="empty-state">
              Não foi possível carregar: {error}{' '}
              <button
                className="text-button"
                type="button"
                onClick={() => loadList(page)}
              >
                Tentar de novo
              </button>
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ENTREGADOR</th>
                  <th>CPF</th>
                  <th>VEICULO</th>
                  <th>PLACA</th>
                  <th>CADASTRO</th>
                  <th>STATUS</th>
                  <th>DISPONIVEL</th>
                  <th>ACOES</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name || `#${item.id.slice(0, 8)}`}</strong>
                      {item.email && (
                        <>
                          <br />
                          <span className="cell-muted">{item.email}</span>
                        </>
                      )}
                    </td>
                    <td>{formatDocument(item.document)}</td>
                    <td>
                      {vehicleLabel[item.vehicleType ?? ''] ??
                        item.vehicleType ??
                        '—'}
                    </td>
                    <td>{item.vehiclePlate ?? '—'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.available ? 'Sim' : 'Nao'}</td>
                    <td className="row-actions">
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              setConfirming({
                                courier: item,
                                kind: 'approve',
                              })
                            }
                          >
                            Aprovar
                          </button>
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() =>
                              setConfirming({ courier: item, kind: 'reject' })
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
                            act('Entregador suspenso', () =>
                              api.suspendCourier(token, item.id),
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
                            act('Entregador reativado', () =>
                              api.approveCourier(token, item.id),
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
          {!loading && !error && !items.length && (
            <p className="empty-state">
              {status
                ? 'Nenhum entregador com esse status.'
                : 'Nenhum entregador cadastrado.'}
            </p>
          )}
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={(p) => loadList(p)}
        />
      </section>

      {/* Confirmação individual — PLANO_ADMIN §7 proíbe aprovar em lote sem
          revisão, então a decisão passa por um resumo do cadastro. */}
      {confirming && (
        <div className="modal-scrim">
          <div className="modal panel">
            <h3>
              {confirming.kind === 'approve'
                ? 'Aprovar entregador?'
                : 'Recusar cadastro?'}
            </h3>
            <p className="modal-summary">
              <strong>
                {confirming.courier.name ||
                  `#${confirming.courier.id.slice(0, 8)}`}
              </strong>
              <br />
              {confirming.courier.email}
              <br />
              CPF {formatDocument(confirming.courier.document)} ·{' '}
              {vehicleLabel[confirming.courier.vehicleType ?? ''] ??
                confirming.courier.vehicleType ??
                '—'}
              {confirming.courier.vehiclePlate
                ? ` · ${confirming.courier.vehiclePlate}`
                : ''}
            </p>
            <p className="modal-note">
              {confirming.kind === 'approve'
                ? 'Ele passa a conseguir entrar no app. Para receber ofertas, ainda precisa ficar online por conta própria — aprovar não coloca ninguém na rua. A ação fica na auditoria e ele recebe uma notificação.'
                : 'O cadastro fica recusado e ele não consegue entrar. A ação fica na auditoria e ele recebe uma notificação.'}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="text-button"
                disabled={acting}
                onClick={() => setConfirming(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={
                  confirming.kind === 'approve'
                    ? 'primary-button'
                    : 'text-button danger'
                }
                disabled={acting}
                onClick={confirmar}
              >
                {acting
                  ? 'Enviando...'
                  : confirming.kind === 'approve'
                    ? 'Aprovar'
                    : 'Recusar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
