import {
  buildHourlySeries,
  buildStatusBreakdown,
  buildTrends,
  computePerformance,
  filterDeliveries,
  matchesDeliveryFilters,
  percentChange,
} from './dashboard-metrics';

describe('dashboard-metrics', () => {
  describe('percentChange', () => {
    it('computes positive and negative deltas', () => {
      expect(percentChange(118, 100)).toBe(18);
      expect(percentChange(95, 100)).toBe(-5);
    });

    it('handles zero baseline', () => {
      expect(percentChange(0, 0)).toBe(0);
      expect(percentChange(10, 0)).toBe(100);
    });
  });

  describe('buildTrends', () => {
    it('returns seven metric blocks with changePercent', () => {
      const trends = buildTrends(
        {
          deliveries: 12,
          inProgress: 3,
          delivered: 8,
          canceled: 1,
          revenueCents: 40000,
          avgMinutes: 28,
        },
        {
          deliveries: 10,
          inProgress: 2,
          delivered: 7,
          canceled: 2,
          revenueCents: 35000,
          avgMinutes: 30,
        },
      );
      expect(trends.deliveriesToday.value).toBe(12);
      expect(trends.deliveriesToday.changePercent).toBe(20);
      expect(trends.canceled.changePercent).toBe(-50);
      expect(trends.avgMinutes.value).toBe(28);
      expect(trends.spendCents.value).toBe(40000);
      expect(trends.savingsCents.value).toBe(10000);
      expect(Object.keys(trends)).toHaveLength(7);
    });
  });

  describe('buildHourlySeries', () => {
    it('fills 24 hour buckets', () => {
      const series = buildHourlySeries([9, 9, 14, 14, 14]);
      expect(series).toHaveLength(24);
      expect(series[9]).toEqual({ hour: 9, count: 2 });
      expect(series[14]).toEqual({ hour: 14, count: 3 });
      expect(series[0].count).toBe(0);
    });
  });

  describe('buildStatusBreakdown', () => {
    it('normalizes counts to numbers', () => {
      expect(
        buildStatusBreakdown([
          { status: 'DELIVERED', count: '5' },
          { status: 'REQUESTED', count: 2 },
        ]),
      ).toEqual([
        { status: 'DELIVERED', count: 5 },
        { status: 'REQUESTED', count: 2 },
      ]);
    });
  });

  describe('computePerformance', () => {
    it('returns score between 0 and 100 with indicators', () => {
      const result = computePerformance({
        delivered: 90,
        canceled: 5,
        total: 100,
        acceptedOffers: 80,
        totalOffers: 100,
        avgScore: 4.5,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.onTimePercent).toBeGreaterThan(0);
      expect(result.acceptRatePercent).toBe(80);
      expect(result.satisfaction).toBe(4.5);
      expect(result.label).toBeTruthy();
    });

    it('handles empty data without NaN', () => {
      const result = computePerformance({
        delivered: 0,
        canceled: 0,
        total: 0,
        acceptedOffers: 0,
        totalOffers: 0,
        avgScore: null,
      });
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('delivery filters', () => {
    const items = [
      {
        status: 'DELIVERED',
        companyId: 'c1',
        courierId: 'k1',
        createdAt: '2026-07-15T10:00:00.000Z',
      },
      {
        status: 'REQUESTED',
        companyId: 'c2',
        courierId: null,
        createdAt: '2026-07-14T10:00:00.000Z',
      },
      {
        status: 'DELIVERED',
        companyId: 'c1',
        courierId: 'k2',
        createdAt: new Date('2026-07-15T18:00:00.000Z'),
      },
    ];

    it('filters by status company courier and date', () => {
      expect(filterDeliveries(items, { status: 'DELIVERED' })).toHaveLength(2);
      expect(filterDeliveries(items, { company: 'c2' })).toHaveLength(1);
      expect(filterDeliveries(items, { courier: 'k1' })).toHaveLength(1);
      expect(filterDeliveries(items, { date: '2026-07-15' })).toHaveLength(2);
      expect(
        filterDeliveries(items, {
          status: 'DELIVERED',
          company: 'c1',
          date: '2026-07-15',
        }),
      ).toHaveLength(2);
    });

    it('matchesDeliveryFilters rejects non-matching rows', () => {
      expect(matchesDeliveryFilters(items[0], { status: 'CANCELED' })).toBe(
        false,
      );
    });
  });
});
