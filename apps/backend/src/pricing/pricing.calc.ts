import { distanceInKm } from '../deliveries/delivery-rules';
import type { PricingConfig, PricingResult } from './pricing.types';

/** Pure pricing: total = max(min, base + km * perKm); platform % of total; courier gets rest. */
export function calculatePricing(
  distanceKm: number,
  config: PricingConfig,
): PricingResult {
  const safeDistance = Math.max(0, distanceKm);
  const raw =
    config.baseFeeCents + Math.round(safeDistance * config.perKmCents);
  const priceCents = Math.max(config.minFeeCents, raw);
  const platformFeeCents = Math.round(
    priceCents * (Math.min(100, Math.max(0, config.platformFeePercent)) / 100),
  );
  const courierFeeCents = Math.max(0, priceCents - platformFeeCents);
  return {
    distanceKm: Math.round(safeDistance * 1000) / 1000,
    priceCents,
    courierFeeCents,
    platformFeeCents,
  };
}

export function calculatePricingBetweenPoints(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number,
  config: PricingConfig,
): PricingResult {
  const km = distanceInKm(pickupLat, pickupLng, deliveryLat, deliveryLng);
  return calculatePricing(km, config);
}
