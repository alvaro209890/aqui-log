import {
  BadRequestException,
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
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { RedisService } from '../redis/redis.module';
import type { SizeSurcharges, WeightBand } from '../pricing/pricing.types';
import { SCHEDULE_MIN_WINDOW_MINUTES } from '../deliveries/scheduling';

/**
 * DEC-02 (2026-08-08, Álvaro): valores PROVISÓRIOS, escolhidos para destravar
 * `B2C-02`/`B2C-06`. Não são calibragem de mercado — são o ponto de partida
 * editável pelo admin. `DEC-19` exige imediato > agendado, e a validação de
 * settings recusa a escrita que quebrar isso.
 */
const DEFAULT_WEIGHT_BANDS: WeightBand[] = [
  { upToKg: 2, surchargeCents: 0 },
  { upToKg: 5, surchargeCents: 200 },
  { upToKg: 10, surchargeCents: 450 },
  { upToKg: 20, surchargeCents: 900 },
];

const DEFAULT_SIZE_SURCHARGES: SizeSurcharges = {
  SMALL: 0,
  MEDIUM: 150,
  LARGE: 400,
};

export type PlatformSettings = {
  offerTtlSeconds: number;
  pricingBaseFeeCents: number;
  /** Legado v1; mantido como fallback de configuração antiga. */
  pricingPerKmCents: number;
  pricingPlatformFeePercent: number;
  pricingMinFeeCents: number;
  // B2C-02 / DEC-02 — preço v2. Todos editáveis pelo admin.
  pricingPerKmImmediateCents: number;
  pricingPerKmScheduledCents: number;
  pricingWeightBands: WeightBand[];
  pricingAboveTopBandCents: number;
  pricingSizeSurchargeCents: SizeSurcharges;
  // Multas e cutoffs (FLOW-DEC-01). Valores provisórios e editáveis; a
  // COBRANÇA em si é escopo de COUR-02/PAY-01 e ainda não existe.
  courierCancelFeeCents: number;
  courierCancelCutoffMinutesImmediate: number;
  courierCancelCutoffMinutesScheduled: number;
  customerCancelFeeCents: number;
  // SCHED-01 — modo agendado. `minScheduleLeadMinutes` é `FLOW-DEC-02` (30);
  // os outros três são PROVISÓRIOS, escolhidos aqui para destravar a
  // capacidade do plano §5.1, e ficam editáveis no admin como o resto.
  minScheduleLeadMinutes: number;
  scheduleMaxWindowMinutes: number;
  scheduleCapacitySlackMinutes: number;
  immediateExecutionEstimateMinutes: number;
};

const REDIS_KEY = 'aqui:settings:platform';

class WeightBandDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1000)
  upToKg!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  surchargeCents!: number;
}

class SizeSurchargeDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  SMALL!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  MEDIUM!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  LARGE!: number;
}

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingPerKmImmediateCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingPerKmScheduledCents?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WeightBandDto)
  pricingWeightBands?: WeightBandDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricingAboveTopBandCents?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SizeSurchargeDto)
  pricingSizeSurchargeCents?: SizeSurchargeDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  courierCancelFeeCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  courierCancelCutoffMinutesImmediate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  courierCancelCutoffMinutesScheduled?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerCancelFeeCents?: number;

  // SCHED-01 / FLOW-DEC-02 + capacidade do plano §5.1.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  minScheduleLeadMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  scheduleMaxWindowMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  scheduleCapacitySlackMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  immediateExecutionEstimateMinutes?: number;
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
      pricingPerKmImmediateCents: Number(
        this.config.get('PRICING_PER_KM_IMMEDIATE_CENTS') ?? 250,
      ),
      pricingPerKmScheduledCents: Number(
        this.config.get('PRICING_PER_KM_SCHEDULED_CENTS') ?? 180,
      ),
      pricingWeightBands: DEFAULT_WEIGHT_BANDS.map((band) => ({ ...band })),
      pricingAboveTopBandCents: Number(
        this.config.get('PRICING_ABOVE_TOP_BAND_CENTS') ?? 1500,
      ),
      pricingSizeSurchargeCents: { ...DEFAULT_SIZE_SURCHARGES },
      courierCancelFeeCents: Number(
        this.config.get('COURIER_CANCEL_FEE_CENTS') ?? 300,
      ),
      courierCancelCutoffMinutesImmediate: Number(
        this.config.get('COURIER_CANCEL_CUTOFF_IMMEDIATE') ?? 5,
      ),
      courierCancelCutoffMinutesScheduled: Number(
        this.config.get('COURIER_CANCEL_CUTOFF_SCHEDULED') ?? 60,
      ),
      customerCancelFeeCents: Number(
        this.config.get('CUSTOMER_CANCEL_FEE_CENTS') ?? 0,
      ),
      minScheduleLeadMinutes: Number(
        this.config.get('MIN_SCHEDULE_LEAD_MINUTES') ?? 30,
      ),
      scheduleMaxWindowMinutes: Number(
        this.config.get('SCHEDULE_MAX_WINDOW_MINUTES') ?? 480,
      ),
      scheduleCapacitySlackMinutes: Number(
        this.config.get('SCHEDULE_CAPACITY_SLACK_MINUTES') ?? 15,
      ),
      immediateExecutionEstimateMinutes: Number(
        this.config.get('IMMEDIATE_EXECUTION_ESTIMATE_MINUTES') ?? 45,
      ),
    };
  }

  /**
   * `DEC-19`: a tarifa/km do imediato tem de ser **estritamente maior** que a
   * do agendado — senão agendar deixa de ser vantajoso e o modo perde sentido.
   * Validado sobre o estado FINAL (atual + patch), não só sobre o patch, para
   * que editar um campo só não consiga quebrar a invariante.
   */
  assertValid(next: PlatformSettings): void {
    if (next.pricingPerKmImmediateCents <= next.pricingPerKmScheduledCents) {
      throw new BadRequestException(
        'O preço por km do imediato deve ser maior que o do agendado (DEC-19).',
      );
    }
    const bands = next.pricingWeightBands ?? [];
    const ordered = [...bands].sort((a, b) => a.upToKg - b.upToKg);
    if (
      ordered.some((band, i) => i > 0 && band.upToKg === ordered[i - 1].upToKg)
    ) {
      throw new BadRequestException(
        'As faixas de peso não podem repetir o mesmo limite (upToKg).',
      );
    }
    // SCHED-01: janela máxima abaixo da mínima operacional tornaria impossível
    // criar qualquer pedido agendado — a tela recusaria tudo em silêncio.
    if (next.scheduleMaxWindowMinutes < SCHEDULE_MIN_WINDOW_MINUTES) {
      throw new BadRequestException(
        `A janela máxima de coleta não pode ser menor que ${SCHEDULE_MIN_WINDOW_MINUTES} minutos.`,
      );
    }
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
    // `class-transformer` instancia o DTO com TODAS as propriedades
    // declaradas: as que não vieram no corpo ficam `undefined` e, no spread,
    // apagariam valores já personalizados (o `JSON.stringify` do Redis
    // descarta `undefined`, então a perda era silenciosa). Também deixavam
    // `assertValid` cego, permitindo furar a invariante do `DEC-19`.
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<PlatformSettings>;
    const next = { ...(await this.get()), ...clean };
    this.assertValid(next);
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
      metadata: clean,
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
