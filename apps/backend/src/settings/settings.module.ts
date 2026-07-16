import {
  Body,
  Controller,
  Get,
  Global,
  Injectable,
  Module,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { RedisService } from '../redis/redis.module';

export type PlatformSettings = {
  offerTtlSeconds: number;
  pricingBaseFeeCents: number;
  pricingPerKmCents: number;
  pricingPlatformFeePercent: number;
  pricingMinFeeCents: number;
};

const REDIS_KEY = 'aqui:settings:platform';

class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3600)
  offerTtlSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingBaseFeeCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingPerKmCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  pricingPlatformFeePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingMinFeeCents?: number;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  defaults(): PlatformSettings {
    return {
      offerTtlSeconds: Number(this.config.get('OFFER_TTL_SECONDS') ?? 120),
      pricingBaseFeeCents: Number(
        this.config.get('PRICING_BASE_FEE_CENTS') ?? 1000,
      ),
      pricingPerKmCents: Number(this.config.get('PRICING_PER_KM_CENTS') ?? 500),
      pricingPlatformFeePercent: Number(
        this.config.get('PRICING_PLATFORM_FEE_PERCENT') ?? 20,
      ),
      pricingMinFeeCents: Number(
        this.config.get('PRICING_MIN_FEE_CENTS') ?? 800,
      ),
    };
  }

  async get(): Promise<PlatformSettings> {
    try {
      const raw = await this.redis.raw.get(REDIS_KEY);
      if (raw) {
        return { ...this.defaults(), ...(JSON.parse(raw) as PlatformSettings) };
      }
    } catch {
      /* redis down */
    }
    return this.defaults();
  }

  async update(
    patch: Partial<PlatformSettings>,
    actorId?: string,
  ): Promise<PlatformSettings> {
    const next = { ...(await this.get()), ...patch };
    try {
      await this.redis.raw.set(REDIS_KEY, JSON.stringify(next));
    } catch {
      /* degraded */
    }
    await this.audit.record({
      actorId,
      action: 'SETTINGS_UPDATED',
      resourceType: 'settings',
      resourceId: 'platform',
      metadata: patch,
    });
    return next;
  }
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.settings.update(dto, req.user.id);
  }
}

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
