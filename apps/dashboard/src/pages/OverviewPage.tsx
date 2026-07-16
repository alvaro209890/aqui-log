import {
  Bike,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  Truck,
  XCircle,
  Leaf,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  api,
  type DeliveryRecord,
  type DashboardTrends,
  type PerformanceResponse,
} from '../api';
import {
  mapHourSeries,
  mapPerformance,
  mapStatusSeries,
  mapTrendsToMetrics,
} from '../chartMappers';
import { DeliveriesByHour } from '../charts/DeliveriesByHour';
import { DeliveriesByStatus } from '../charts/DeliveriesByStatus';
import { PerformanceGauge } from '../charts/PerformanceGauge';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { LiveMap } from '../LiveMap';

const metricIcons: Record<string, ReactNode> = {
  deliveriesToday: <PackageCheck />,
  inProgress: <Bike />,
  delivered: <PackageCheck />,
  canceled: <XCircle />,
  avgMinutes: <Clock3 />,
  spendCents: <CircleDollarSign />,
  savingsCents: <Leaf />,
};

function relativeTime(date: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60000),
  );
  return minutes < 1 ? 'agora' : `${minutes} min`;
}

export function OverviewPage({ token, userName }: { token: string; userName: string }) {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [hourData, setHourData] = useState<Array<{ hour: string; count: number }>>([]);
  const [statusData, setStatusData] = useState<Array<{ name: string; value: number }>>([]);
  const [performance, setPerformance] = useState<ReturnType<typeof mapPerformance> | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.trends(token),
      api.deliveriesByHour(token),
      api.deliveriesByStatus(token),
      api.performance(token),
      api.deliveries(token, { page: 1, limit: 8 }),
    ])
      .then(([t, h, s, p, d]) => {
        if (cancelled) return;
        setTrends(t);
        setHourData(mapHourSeries(h));
        setStatusData(mapStatusSeries(s));
        setPerformance(mapPerformance(p as PerformanceResponse));
        setDeliveries(d.items.slice(0, 8));
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const metrics = trends ? mapTrendsToMetrics(trends) : [];

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' })
              .format(new Date())
              .toUpperCase()}
          </p>
          <h1>Bom dia, {userName.split(' ')[0]}.</h1>
          <span>Acompanhe a operacao da Aqui Log em tempo real.</span>
        </div>
        <button className="primary-button" type="button">
          <Truck size={18} /> Nova entrega
        </button>
      </section>

      <section className="metrics metrics-7" aria-label="Indicadores da operacao">
        {loading
          ? Array.from({ length: 7 }).map((_, index) => (
              <MetricCard
                key={index}
                icon={<PackageCheck />}
                tone="mint"
                label="..."
                value="—"
                changePercent={null}
                loading
              />
            ))
          : metrics.map((item) => (
              <MetricCard
                key={item.key}
                icon={metricIcons[item.key] ?? <PackageCheck />}
                tone={item.tone}
                label={item.label}
                value={item.value}
                changePercent={item.changePercent}
              />
            ))}
      </section>

      <section className="charts-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Entregas por hora</h2>
              <p>Volume ao longo do dia</p>
            </div>
          </div>
          <DeliveriesByHour data={hourData} loading={loading} />
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Entregas por status</h2>
              <p>Distribuicao operacional</p>
            </div>
          </div>
          <DeliveriesByStatus data={statusData} loading={loading} />
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Desempenho geral</h2>
              <p>Score operacional 0–100</p>
            </div>
          </div>
          <PerformanceGauge
            score={performance?.score ?? 0}
            label={performance?.label ?? '—'}
            loading={loading}
          />
          {performance && !loading && (
            <div className="health-mini">
              <div>
                <span>No prazo</span>
                <strong>{performance.onTimePercent}%</strong>
              </div>
              <div>
                <span>Aceite</span>
                <strong>{performance.acceptRatePercent}%</strong>
              </div>
              <div>
                <span>Satisfacao</span>
                <strong>{performance.satisfaction}</strong>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel operation-map">
          <div className="panel-heading">
            <div>
              <h2>Operacao ao vivo</h2>
              <p>Mapa com entregas recentes</p>
            </div>
          </div>
          <div className="map-canvas">
            <LiveMap deliveries={deliveries} token={token} />
          </div>
        </article>
        <article className="panel deliveries-panel">
          <div className="panel-heading">
            <div>
              <h2>Entregas recentes</h2>
              <p>Ultimas movimentacoes</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ENTREGA</th>
                  <th>ROTA</th>
                  <th>STATUS</th>
                  <th>ATUALIZACAO</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>
                      {item.pickupAddress} → {item.deliveryAddress}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{relativeTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!deliveries.length && !loading && (
              <p className="empty-state">Nenhuma entrega cadastrada.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
