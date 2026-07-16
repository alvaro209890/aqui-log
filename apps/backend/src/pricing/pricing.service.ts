import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.module';
import { calculatePricingBetweenPoints } from './pricing.calc';
import type { PricingConfig, PricingResult } from './pricing.types';

@Injectable()
export class PricingService {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  /** Sync env fallback (tests / early boot). Prefer getConfigAsync in requests. */
  getConfig(): PricingConfig {
    return {
      baseFeeCents: Number(this.config.get('PRICING_BASE_FEE_CENTS') ?? 1000),
      perKmCents: Number(this.config.get('PRICING_PER_KM_CENTS') ?? 500),
      platformFeePercent: Number(
        this.config.get('PRICING_PLATFORM_FEE_PERCENT') ?? 20,
      ),
      minFeeCents: Number(this.config.get('PRICING_MIN_FEE_CENTS') ?? 800),
    };
  }

  async getConfigAsync(): Promise<PricingConfig> {
    const s = await this.settings.get();
    return {
      baseFeeCents: s.pricingBaseFeeCents,
      perKmCents: s.pricingPerKmCents,
      platformFeePercent: s.pricingPlatformFeePercent,
      minFeeCents: s.pricingMinFeeCents,
    };
  }

  quote(params: {
    pickupLatitude: number;
    pickupLongitude: number;
    deliveryLatitude: number;
    deliveryLongitude: number;
  }): PricingResult {
    return calculatePricingBetweenPoints(
      Number(params.pickupLatitude),
      Number(params.pickupLongitude),
      Number(params.deliveryLatitude),
      Number(params.deliveryLongitude),
      this.getConfig(),
    );
  }

  async quoteAsync(params: {
    pickupLatitude: number;
    pickupLongitude: number;
    deliveryLatitude: number;
    deliveryLongitude: number;
  }): Promise<PricingResult> {
    return calculatePricingBetweenPoints(
      Number(params.pickupLatitude),
      Number(params.pickupLongitude),
      Number(params.deliveryLatitude),
      Number(params.deliveryLongitude),
      await this.getConfigAsync(),
    );
  }
}
