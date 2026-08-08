import {
  calculatePricing,
  calculatePricingBetweenPoints,
  calculatePricingV2,
  kmRateFor,
  sizeSurchargeFor,
  weightSurchargeFor,
} from './pricing.calc';
import { PRICING_VERSION, type PricingConfig } from './pricing.types';

/** Config v1: sem faixas, sem tarifa por modo. */
const config: PricingConfig = {
  baseFeeCents: 1000,
  perKmCents: 500,
  platformFeePercent: 20,
  minFeeCents: 800,
};

/** Config v2 com os valores provisórios do `DEC-02`. */
const configV2: PricingConfig = {
  baseFeeCents: 700,
  perKmCents: 250,
  platformFeePercent: 20,
  minFeeCents: 900,
  perKmImmediateCents: 250,
  perKmScheduledCents: 180,
  weightBands: [
    { upToKg: 2, surchargeCents: 0 },
    { upToKg: 5, surchargeCents: 200 },
    { upToKg: 10, surchargeCents: 450 },
    { upToKg: 20, surchargeCents: 900 },
  ],
  aboveTopBandCents: 1500,
  sizeSurchargeCents: { SMALL: 0, MEDIUM: 150, LARGE: 400 },
};

describe('calculatePricing (compatibilidade v1)', () => {
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
    expect(result.breakdown.minFeeApplied).toBe(true);
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

  it('cai no perKmCents legado quando não há tarifa por modo', () => {
    expect(kmRateFor(config, 'IMMEDIATE')).toBe(500);
    expect(kmRateFor(config, 'SCHEDULED')).toBe(500);
  });
});

describe('calculatePricingBetweenPoints', () => {
  it('uses haversine distance', () => {
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

describe('faixa de peso (B2C-02)', () => {
  it.each([
    [0.5, 0, 2],
    [2, 0, 2],
    [2.001, 200, 5],
    [5, 200, 5],
    [7, 450, 10],
    [20, 900, 20],
  ])('peso %s kg → adicional %s (faixa %s)', (kg, cents, band) => {
    expect(weightSurchargeFor(configV2, kg)).toEqual({
      surchargeCents: cents,
      bandUpToKg: band,
    });
  });

  it('acima da última faixa cobra o adicional de excedente', () => {
    expect(weightSurchargeFor(configV2, 50)).toEqual({
      surchargeCents: 1500,
      bandUpToKg: null,
    });
  });

  it('pedido legado sem peso não paga adicional', () => {
    expect(weightSurchargeFor(configV2, null)).toEqual({
      surchargeCents: 0,
      bandUpToKg: null,
    });
  });

  it('ordena as faixas antes de escolher, mesmo fora de ordem', () => {
    const desordenado: PricingConfig = {
      ...configV2,
      weightBands: [
        { upToKg: 10, surchargeCents: 450 },
        { upToKg: 2, surchargeCents: 0 },
        { upToKg: 5, surchargeCents: 200 },
      ],
    };
    expect(weightSurchargeFor(desordenado, 3).surchargeCents).toBe(200);
  });
});

describe('adicional de tamanho (B2C-02)', () => {
  it.each([
    ['SMALL', 0],
    ['MEDIUM', 150],
    ['LARGE', 400],
  ] as const)('%s → %s', (size, cents) => {
    expect(sizeSurchargeFor(configV2, size)).toBe(cents);
  });

  it('pedido legado sem tamanho não paga adicional', () => {
    expect(sizeSurchargeFor(configV2, null)).toBe(0);
  });
});

describe('preço v2 completo', () => {
  it('soma base + km + peso + tamanho e devolve o breakdown', () => {
    const result = calculatePricingV2(
      {
        distanceKm: 4,
        fulfillmentMode: 'IMMEDIATE',
        weightKg: 7,
        packageSize: 'MEDIUM',
      },
      configV2,
    );
    // 700 + 4*250 + 450 + 150 = 2300
    expect(result.priceCents).toBe(2300);
    expect(result.pricingVersion).toBe(PRICING_VERSION);
    expect(result.breakdown).toMatchObject({
      kmRateCents: 250,
      baseFeeCents: 700,
      distanceCents: 1000,
      weightSurchargeCents: 450,
      weightBandUpToKg: 10,
      sizeSurchargeCents: 150,
      subtotalCents: 2300,
      minFeeApplied: false,
      fulfillmentMode: 'IMMEDIATE',
    });
    expect(result.courierFeeCents + result.platformFeeCents).toBe(
      result.priceCents,
    );
  });

  it('agendado sai mais barato que imediato na mesma distância (DEC-19)', () => {
    const base = {
      distanceKm: 10,
      weightKg: 1,
      packageSize: 'SMALL' as const,
    };
    const imediato = calculatePricingV2(
      { ...base, fulfillmentMode: 'IMMEDIATE' },
      configV2,
    );
    const agendado = calculatePricingV2(
      { ...base, fulfillmentMode: 'SCHEDULED' },
      configV2,
    );
    expect(agendado.priceCents).toBeLessThan(imediato.priceCents);
    expect(agendado.breakdown.kmRateCents).toBe(180);
    expect(imediato.breakdown.kmRateCents).toBe(250);
  });

  it('aplica o piso quando a soma fica abaixo dele', () => {
    const result = calculatePricingV2(
      { distanceKm: 0, weightKg: 1, packageSize: 'SMALL' },
      configV2,
    );
    expect(result.breakdown.subtotalCents).toBe(700);
    expect(result.priceCents).toBe(900);
    expect(result.breakdown.minFeeApplied).toBe(true);
  });

  it('pedido legado (sem peso e sem tamanho) continua precificável', () => {
    const result = calculatePricingV2({ distanceKm: 3 }, configV2);
    // 700 + 3*250 = 1450, sem adicionais
    expect(result.priceCents).toBe(1450);
    expect(result.breakdown.weightKg).toBeNull();
    expect(result.breakdown.packageSize).toBeNull();
  });

  it('distância negativa é tratada como zero', () => {
    const result = calculatePricingV2({ distanceKm: -5 }, configV2);
    expect(result.distanceKm).toBe(0);
    expect(result.breakdown.distanceCents).toBe(0);
  });
});
