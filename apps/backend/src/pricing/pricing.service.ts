import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculatePricingBetweenPoints } from './pricing.calc';
import type { PricingConfig, PricingResult } from './pricing.types';

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

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
}
