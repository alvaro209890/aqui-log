import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type NotificationRecord } from '../api';

export function AlertsPage({ token }: { token: string }) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .notifications(token)
      .then(setItems)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>CENTRAL</p>
          <h1>Alertas</h1>
          <span>Notificacoes e eventos da sua conta administrativa.</span>
        </div>
      </section>
      <section className="panel">
        {loading ? (
          <div className="skeleton-table" style={{ padding: 20 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : (
          <ul className="alerts-list">
            {items.map((item) => (
              <li key={item.id} className={item.readAt ? 'read' : 'unread'}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span className="muted">
                    {item.type} ·{' '}
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                {!item.readAt && <em className="badge-new">Novo</em>}
              </li>
            ))}
          </ul>
        )}
        {!loading && !items.length && (
          <p className="empty-state">Nenhum alerta no momento.</p>
        )}
      </section>
    </div>
  );
}
