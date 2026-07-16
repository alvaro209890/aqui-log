import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type ReportRange } from '../api';
import { formatCurrency } from '../chartMappers';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage({ token }: { token: string }) {
  const [from, setFrom] = useState(daysAgoIso(7));
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState<ReportRange | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .reportRange(token, from, to)
      .then(setReport)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const exportCsv = () => {
    if (!report) return;
    const lines = [
      'metric,value',
      `from,${report.from}`,
      `to,${report.to}`,
      `timezone,${report.timezone}`,
      `created,${report.created}`,
      `delivered,${report.delivered}`,
      `canceled,${report.canceled}`,
      `revenueCents,${report.revenueCents}`,
      ...report.byStatus.map((s) => `status_${s.status},${s.count}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquilog-report-${report.from}_${report.to}.csv`;
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
          <span>Periodo em timezone operacional (America/Sao_Paulo).</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={exportCsv}
          disabled={!report}
        >
          Exportar CSV
        </button>
      </section>

      <div className="filters-bar panel">
        <label>
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Ate
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={load}>
          Gerar
        </button>
      </div>

      <section className="panel report-card">
        {loading || !report ? (
          <div className="skeleton-table">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : (
          <ul className="report-list">
            <li>
              <span>PERIODO</span>
              <strong>
                {report.from} → {report.to} ({report.timezone})
              </strong>
            </li>
            <li>
              <span>CRIADAS</span>
              <strong>{report.created}</strong>
            </li>
            <li>
              <span>ENTREGUES</span>
              <strong>{report.delivered}</strong>
            </li>
            <li>
              <span>CANCELADAS</span>
              <strong>{report.canceled}</strong>
            </li>
            <li>
              <span>RECEITA</span>
              <strong>{formatCurrency(report.revenueCents)}</strong>
            </li>
            {report.byStatus.map((s) => (
              <li key={s.status}>
                <span>STATUS {s.status}</span>
                <strong>{s.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
