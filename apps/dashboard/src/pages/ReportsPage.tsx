import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type DashboardTrends, type PerformanceResponse } from '../api';
import { formatCurrency, mapTrendsToMetrics } from '../chartMappers';

export function ReportsPage({ token }: { token: string }) {
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.trends(token), api.performance(token)])
      .then(([t, p]) => {
        setTrends(t);
        setPerformance(p);
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const exportCsv = () => {
    if (!trends) return;
    const metrics = mapTrendsToMetrics(trends);
    const lines = [
      'metric,value,changePercent',
      ...metrics.map(
        (m) => `${m.label},${m.value},${m.changePercent ?? ''}`,
      ),
      `SCORE,${performance?.score ?? ''},`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquilog-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatorio exportado');
  };

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>INTELIGENCIA</p>
          <h1>Relatorios</h1>
          <span>Resumo exportavel da operacao do dia.</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={exportCsv}
          disabled={!trends}
        >
          Exportar CSV
        </button>
      </section>
      <section className="panel report-card">
        {loading || !trends ? (
          <div className="skeleton-table">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : (
          <ul className="report-list">
            {mapTrendsToMetrics(trends).map((m) => (
              <li key={m.key}>
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </li>
            ))}
            <li>
              <span>SCORE DESEMPENHO</span>
              <strong>{performance?.score ?? '—'} / 100</strong>
            </li>
            <li>
              <span>GASTO (ref.)</span>
              <strong>{formatCurrency(trends.spendCents.value)}</strong>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
