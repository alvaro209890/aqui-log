/**
 * B2C-02 — preço v2 versionado.
 *
 * A versão é gravada em cada pedido junto do breakdown, para que mudança de
 * settings **não** altere pedido já criado (`DEC-19`). Ao mexer na fórmula,
 * suba `PRICING_VERSION`; ao mexer só em valores, não suba — os valores já
 * ficam congelados no breakdown do pedido.
 */
export const PRICING_VERSION = 2;

export const FULFILLMENT_MODES = ['IMMEDIATE', 'SCHEDULED'] as const;
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

/**
 * Faixa de peso: vale para peso **até** `upToKg` (inclusive). A lista é
 * ordenada por `upToKg`; peso acima da última faixa usa `aboveTopBandCents`.
 */
export type WeightBand = {
  upToKg: number;
  surchargeCents: number;
};

export type SizeSurcharges = {
  SMALL: number;
  MEDIUM: number;
  LARGE: number;
};

export type PricingConfig = {
  baseFeeCents: number;
  /** Legado v1: usado como fallback quando não há tarifa por modo. */
  perKmCents: number;
  platformFeePercent: number;
  minFeeCents: number;
  /** v2 — `DEC-19`: imediato deve ser > agendado. */
  perKmImmediateCents?: number;
  perKmScheduledCents?: number;
  weightBands?: WeightBand[];
  aboveTopBandCents?: number;
  sizeSurchargeCents?: SizeSurcharges;
};

export type PricingBreakdown = {
  version: number;
  fulfillmentMode: FulfillmentMode;
  distanceKm: number;
  kmRateCents: number;
  baseFeeCents: number;
  distanceCents: number;
  weightKg: number | null;
  weightBandUpToKg: number | null;
  weightSurchargeCents: number;
  packageSize: keyof SizeSurcharges | null;
  sizeSurchargeCents: number;
  subtotalCents: number;
  minFeeCents: number;
  minFeeApplied: boolean;
  platformFeePercent: number;
  // DISP-02 / DEC-03 §3.3 — quando o cliente consente o aumento para destravar
  // a busca, o snapshot do pedido é reescrito e este bloco anota o que mudou.
  // O pedido não guarda histórico (a trilha está em `delivery_events` +
  // auditoria); aqui fica só o laço com o preço anterior.
  boost?: {
    previousPriceCents: number;
    boostPercent: number;
    boostedAt: string;
  };
};

export type PricingResult = {
  distanceKm: number;
  priceCents: number;
  courierFeeCents: number;
  platformFeeCents: number;
  pricingVersion: number;
  breakdown: PricingBreakdown;
};

export type PricingInput = {
  distanceKm: number;
  fulfillmentMode?: FulfillmentMode;
  weightKg?: number | null;
  packageSize?: keyof SizeSurcharges | null;
};
