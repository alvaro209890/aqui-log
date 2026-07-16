import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type RatingRecord } from '../api';

export function RatingsPage({ token }: { token: string }) {
  const [items, setItems] = useState<RatingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .ratings(token)
      .then(setItems)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>QUALIDADE</p>
          <h1>Avaliacoes</h1>
          <span>Notas das empresas sobre entregas concluidas.</span>
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
                  <th>NOTA</th>
                  <th>ENTREGA</th>
                  <th>ENTREGADOR</th>
                  <th>COMENTARIO</th>
                  <th>DATA</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.score}/5</strong>
                    </td>
                    <td>#{item.deliveryId.slice(0, 8)}</td>
                    <td>#{item.courierId.slice(0, 8)}</td>
                    <td>{item.comment ?? '—'}</td>
                    <td>
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !items.length && (
            <p className="empty-state">Nenhuma avaliacao ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
