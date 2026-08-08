import { distanceInKm } from '../deliveries/delivery-rules';
import {
  PRICING_VERSION,
  type FulfillmentMode,
  type PricingConfig,
  type PricingInput,
  type PricingResult,
  type SizeSurcharges,
  type WeightBand,
} from './pricing.types';

/**
 * Tarifa por km do modo. `DEC-19` manda imediato > agendado; a validação de
 * settings garante isso na escrita. Aqui só resolvemos o valor, com o
 * `perKmCents` do v1 como fallback para configuração antiga.
 */
export function kmRateFor(
  config: PricingConfig,
  mode: FulfillmentMode,
): number {
  const rate =
    mode === 'SCHEDULED'
      ? config.perKmScheduledCents
      : config.perKmImmediateCents;
  return Math.max(0, rate ?? config.perKmCents);
}

/**
 * Adicional de peso. Faixas valem "até X kg" (inclusive); acima da última,
 * cobra-se `aboveTopBandCents`. Pedido legado sem peso não paga adicional —
 * a obrigatoriedade de `B2C-05` vale só para pedido novo.
 */
export function weightSurchargeFor(
  config: PricingConfig,
  weightKg: number | null | undefined,
): { surchargeCents: number; bandUpToKg: number | null } {
  const bands = [...(config.weightBands ?? [])].sort(
    (a, b) => a.upToKg - b.upToKg,
  );
  if (weightKg == null || !Number.isFinite(weightKg) || bands.length === 0) {
    return { surchargeCents: 0, bandUpToKg: null };
  }
  const band: WeightBand | undefined = bands.find(
    (candidate) => weightKg <= candidate.upToKg,
  );
  if (!band) {
    return {
      surchargeCents: Math.max(0, config.aboveTopBandCents ?? 0),
      bandUpToKg: null,
    };
  }
  return {
    surchargeCents: Math.max(0, band.surchargeCents),
    bandUpToKg: band.upToKg,
  };
}

export function sizeSurchargeFor(
  config: PricingConfig,
  packageSize: keyof SizeSurcharges | null | undefined,
): number {
  if (!packageSize) return 0;
  const table = config.sizeSurchargeCents;
  if (!table) return 0;
  return Math.max(0, table[packageSize] ?? 0);
}

/**
 * Preço v2 (puro): base + km*tarifa + adicional de peso + adicional de
 * tamanho, com piso `minFeeCents`. A plataforma retém um percentual do total
 * e o restante é do prestador — nunca negativo.
 */
export function calculatePricingV2(
  input: PricingInput,
  config: PricingConfig,
): PricingResult {
  const mode: FulfillmentMode = input.fulfillmentMode ?? 'IMMEDIATE';
  const safeDistance = Math.max(0, input.distanceKm);
  const kmRateCents = kmRateFor(config, mode);
  const distanceCents = Math.round(safeDistance * kmRateCents);
  const weight = weightSurchargeFor(config, input.weightKg);
  const sizeSurcharge = sizeSurchargeFor(config, input.packageSize);

  const subtotalCents =
    config.baseFeeCents + distanceCents + weight.surchargeCents + sizeSurcharge;
  const priceCents = Math.max(config.minFeeCents, subtotalCents);
  const platformFeePercent = Math.min(
    100,
    Math.max(0, config.platformFeePercent),
  );
  const platformFeeCents = Math.round(priceCents * (platformFeePercent / 100));
  const courierFeeCents = Math.max(0, priceCents - platformFeeCents);
  const distanceKm = Math.round(safeDistance * 1000) / 1000;

  return {
    distanceKm,
    priceCents,
    courierFeeCents,
    platformFeeCents,
    pricingVersion: PRICING_VERSION,
    breakdown: {
      version: PRICING_VERSION,
      fulfillmentMode: mode,
      distanceKm,
      kmRateCents,
      baseFeeCents: config.baseFeeCents,
      distanceCents,
      weightKg: input.weightKg ?? null,
      weightBandUpToKg: weight.bandUpToKg,
      weightSurchargeCents: weight.surchargeCents,
      packageSize: input.packageSize ?? null,
      sizeSurchargeCents: sizeSurcharge,
      subtotalCents,
      minFeeCents: config.minFeeCents,
      minFeeApplied: priceCents > subtotalCents,
      platformFeePercent,
    },
  };
}

/** Assinatura v1 preservada: distância pura, sem peso/tamanho/modo. */
export function calculatePricing(
  distanceKm: number,
  config: PricingConfig,
): PricingResult {
  return calculatePricingV2({ distanceKm }, config);
}

export function calculatePricingBetweenPoints(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
  config: PricingConfig,
  extra: Omit<PricingInput, 'distanceKm'> = {},
): PricingResult {
  const km = distanceInKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return calculatePricingV2({ distanceKm: km, ...extra }, config);
}
