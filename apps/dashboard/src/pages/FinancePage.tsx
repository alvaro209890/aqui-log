import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type FinanceSummary } from '../api';
import { formatCurrency } from '../chartMappers';

export function FinancePage({ token }: { token: string }) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .financeSummary(token)
      .then(setData)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const net =
    data == null
      ? 0
      : (data.netCents ?? data.grossCents - data.courierCostCents);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>GESTAO</p>
          <h1>Financeiro</h1>
          <span>Totais de faturamento e custo de entregadores.</span>
        </div>
      </section>
      {loading ? (
        <div className="metrics metrics-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metric-card skeleton-card">
              <div className="skeleton skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <section className="metrics metrics-3">
          <article className="metric-card">
            <div>
              <p>BRUTO</p>
              <strong>{formatCurrency(data?.grossCents ?? 0)}</strong>
            </div>
          </article>
          <article className="metric-card">
            <div>
              <p>CUSTO ENTREGADORES</p>
              <strong>{formatCurrency(data?.courierCostCents ?? 0)}</strong>
            </div>
          </article>
          <article className="metric-card">
            <div>
              <p>LIQUIDO / ENTREGAS</p>
              <strong>
                {formatCurrency(net)} · {data?.deliveredCount ?? 0}
              </strong>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
