import type {
  DashboardTrends,
  HourSeriesResponse,
  PerformanceResponse,
  StatusSeriesResponse,
  TrendMetric,
} from './api';

export type MetricCardModel = {
  key: string;
  label: string;
  value: string;
  changePercent: number | null;
  tone: string;
};

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatChange(changePercent: number | null): string {
  if (changePercent === null) return '—';
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent}%`;
}

export function mapTrendsToMetrics(trends: DashboardTrends): MetricCardModel[] {
  const money = (m: TrendMetric) => formatCurrency(m.value);
  const plain = (m: TrendMetric, suffix = '') =>
    `${m.value}${suffix}`;
  return [
    {
      key: 'deliveriesToday',
      label: 'ENTREGAS HOJE',
      value: plain(trends.deliveriesToday),
      changePercent: trends.deliveriesToday.changePercent,
      tone: 'mint',
    },
    {
      key: 'inProgress',
      label: 'EM ANDAMENTO',
      value: plain(trends.inProgress),
      changePercent: trends.inProgress.changePercent,
      tone: 'blue',
    },
    {
      key: 'delivered',
      label: 'CONCLUIDAS',
      value: plain(trends.delivered),
      changePercent: trends.delivered.changePercent,
      tone: 'mint',
    },
    {
      key: 'canceled',
      label: 'CANCELADAS',
      value: plain(trends.canceled),
      changePercent: trends.canceled.changePercent,
      tone: 'sand',
    },
    {
      key: 'avgMinutes',
      label: 'TEMPO MEDIO',
      value: `${trends.avgMinutes.value}min`,
      changePercent: trends.avgMinutes.changePercent,
      tone: 'blue',
    },
    {
      key: 'spendCents',
      label: 'GASTO DO DIA',
      value: money(trends.spendCents),
      changePercent: trends.spendCents.changePercent,
      tone: 'purple',
    },
    {
      key: 'savingsCents',
      label: 'ECONOMIA GERADA',
      value: money(trends.savingsCents),
      changePercent: trends.savingsCents.changePercent,
      tone: 'mint',
    },
  ];
}

export function mapHourSeries(data: HourSeriesResponse) {
  return data.series.map((row) => ({
    hour: `${String(row.hour).padStart(2, '0')}h`,
    count: row.count,
  }));
}

export function mapStatusSeries(data: StatusSeriesResponse) {
  return data.items.map((row) => ({
    name: row.status,
    value: row.count,
  }));
}

export function mapPerformance(data: PerformanceResponse) {
  return {
    score: Math.max(0, Math.min(100, data.score)),
    onTimePercent: data.onTimePercent,
    acceptRatePercent: data.acceptRatePercent,
    satisfaction: data.satisfaction,
    label: data.label,
  };
}
