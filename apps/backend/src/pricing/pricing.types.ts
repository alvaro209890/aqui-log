export type PricingConfig = {
  baseFeeCents: number;
  perKmCents: number;
  platformFeePercent: number;
  minFeeCents: number;
};

export type PricingResult = {
  distanceKm: number;
  priceCents: number;
  courierFeeCents: number;
  platformFeeCents: number;
};
