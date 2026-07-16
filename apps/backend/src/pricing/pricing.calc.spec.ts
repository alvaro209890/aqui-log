import {
  calculatePricing,
  calculatePricingBetweenPoints,
} from './pricing.calc';

const config = {
  baseFeeCents: 1000,
  perKmCents: 500,
  platformFeePercent: 20,
  minFeeCents: 800,
};

describe('calculatePricing', () => {
  it('applies base + per-km and splits platform fee', () => {
    const result = calculatePricing(2, config);
    // 1000 + 2*500 = 2000; platform 20% = 400; courier = 1600
    expect(result.priceCents).toBe(2000);
    expect(result.platformFeeCents).toBe(400);
    expect(result.courierFeeCents).toBe(1600);
    expect(result.distanceKm).toBe(2);
  });

  it('respects minimum fee', () => {
    const result = calculatePricing(0, {
      ...config,
      baseFeeCents: 100,
      minFeeCents: 800,
    });
    expect(result.priceCents).toBe(800);
    expect(result.platformFeeCents).toBe(160);
    expect(result.courierFeeCents).toBe(640);
  });

  it('never returns negative courier fee', () => {
    const result = calculatePricing(1, {
      baseFeeCents: 100,
      perKmCents: 0,
      platformFeePercent: 100,
      minFeeCents: 100,
    });
    expect(result.courierFeeCents).toBe(0);
    expect(result.platformFeeCents).toBe(100);
  });
});

describe('calculatePricingBetweenPoints', () => {
  it('uses haversine distance', () => {
    // ~1.11 km for 0.01 deg latitude near equator-ish BH coords
    const result = calculatePricingBetweenPoints(
      -19.92,
      -43.93,
      -19.93,
      -43.93,
      config,
    );
    expect(result.distanceKm).toBeGreaterThan(0.5);
    expect(result.distanceKm).toBeLessThan(2);
    expect(result.priceCents).toBeGreaterThanOrEqual(config.minFeeCents);
    expect(result.courierFeeCents + result.platformFeeCents).toBe(
      result.priceCents,
    );
  });
});
