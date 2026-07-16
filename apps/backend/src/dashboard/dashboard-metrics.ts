export type DayCounts = {
  deliveries: number;
  inProgress: number;
  delivered: number;
  canceled: number;
  revenueCents: number;
  avgMinutes: number | null;
};

export type TrendMetric = {
  value: number;
  previous: number;
  changePercent: number | null;
};

export type TrendsResult = {
  deliveriesToday: TrendMetric;
  inProgress: TrendMetric;
  delivered: TrendMetric;
  canceled: TrendMetric;
  avgMinutes: TrendMetric;
  spendCents: TrendMetric;
  savingsCents: TrendMetric;
};

export type HourBucket = { hour: number; count: number };

export type StatusBucket = { status: string; count: number };

export type PerformanceResult = {
  score: number;
  onTimePercent: number;
  acceptRatePercent: number;
  satisfaction: number;
  label: string;
};

/** Percent change of current vs previous. Null when previous is 0 and current is 0. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildTrendMetric(
  current: number,
  previous: number,
): TrendMetric {
  return {
    value: current,
    previous,
    changePercent: percentChange(current, previous),
  };
}

export function buildTrends(
  today: DayCounts,
  yesterday: DayCounts,
): TrendsResult {
  // Placeholder economy metric (no ML routes yet): 25% of spend as "savings"
  const todaySavings = Math.round(today.revenueCents * 0.25);
  const yesterdaySavings = Math.round(yesterday.revenueCents * 0.25);
  return {
    deliveriesToday: buildTrendMetric(today.deliveries, yesterday.deliveries),
    inProgress: buildTrendMetric(today.inProgress, yesterday.inProgress),
    delivered: buildTrendMetric(today.delivered, yesterday.delivered),
    canceled: buildTrendMetric(today.canceled, yesterday.canceled),
    avgMinutes: buildTrendMetric(
      today.avgMinutes ?? 0,
      yesterday.avgMinutes ?? 0,
    ),
    spendCents: buildTrendMetric(today.revenueCents, yesterday.revenueCents),
    savingsCents: buildTrendMetric(todaySavings, yesterdaySavings),
  };
}

/** Build 24 hourly buckets (0–23) from created-at timestamps (local day hours). */
export function buildHourlySeries(
  hours: number[],
  fullDay = true,
): HourBucket[] {
  const counts = new Map<number, number>();
  for (let h = 0; h < 24; h++) counts.set(h, 0);
  for (const hour of hours) {
    const key = Math.max(0, Math.min(23, Math.floor(hour)));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const series: HourBucket[] = [];
  for (let h = 0; h < 24; h++) {
    if (!fullDay && (counts.get(h) ?? 0) === 0) continue;
    series.push({ hour: h, count: counts.get(h) ?? 0 });
  }
  return fullDay
    ? series
    : Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: counts.get(h) ?? 0,
      }));
}

export function buildStatusBreakdown(
  rows: Array<{ status: string; count: number | string }>,
): StatusBucket[] {
  return rows.map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));
}

export function computePerformance(input: {
  delivered: number;
  canceled: number;
  total: number;
  acceptedOffers: number;
  totalOffers: number;
  avgScore: number | null;
}): PerformanceResult {
  const completionBase =
    input.total === 0 ? 100 : Math.round((input.delivered / input.total) * 100);
  const cancelPenalty =
    input.total === 0
      ? 0
      : Math.min(40, Math.round((input.canceled / input.total) * 100));
  const onTimePercent = Math.max(
    0,
    Math.min(100, completionBase - cancelPenalty / 2),
  );

  const acceptRatePercent =
    input.totalOffers === 0
      ? 100
      : Math.round((input.acceptedOffers / input.totalOffers) * 100);

  const satisfaction =
    input.avgScore === null ? 4.8 : Math.round(input.avgScore * 10) / 10;

  const satisfactionScore = Math.round((satisfaction / 5) * 100);
  const score = Math.round(
    onTimePercent * 0.45 + acceptRatePercent * 0.3 + satisfactionScore * 0.25,
  );
  const clamped = Math.max(0, Math.min(100, score));

  let label = 'Regular';
  if (clamped >= 90) label = 'Excelente';
  else if (clamped >= 75) label = 'Bom';
  else if (clamped >= 50) label = 'Atencao';
  else label = 'Critico';

  return {
    score: clamped,
    onTimePercent,
    acceptRatePercent,
    satisfaction,
    label,
  };
}

export type DeliveryFilterInput = {
  status?: string;
  company?: string;
  courier?: string;
  date?: string;
};

export type FilterableDelivery = {
  status: string;
  companyId: string;
  courierId: string | null;
  createdAt: Date | string;
};

/** Pure filter predicates for unit testing without HTTP/DB. */
export function matchesDeliveryFilters(
  delivery: FilterableDelivery,
  filters: DeliveryFilterInput,
): boolean {
  if (filters.status && delivery.status !== filters.status) return false;
  if (filters.company && delivery.companyId !== filters.company) return false;
  if (filters.courier) {
    if (delivery.courierId !== filters.courier) return false;
  }
  if (filters.date) {
    const day = filters.date.slice(0, 10);
    const created =
      typeof delivery.createdAt === 'string'
        ? delivery.createdAt.slice(0, 10)
        : delivery.createdAt.toISOString().slice(0, 10);
    if (created !== day) return false;
  }
  return true;
}

export function filterDeliveries<T extends FilterableDelivery>(
  items: T[],
  filters: DeliveryFilterInput,
): T[] {
  return items.filter((item) => matchesDeliveryFilters(item, filters));
}
