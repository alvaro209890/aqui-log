import {
  BadRequestException,
  Body,
  Controller,
  Injectable,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { createHash } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisService } from '../redis/redis.module';

class GeocodeDto {
  @IsString()
  @MinLength(3)
  address!: string;
}

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: string;
};

@Injectable()
export class GeoService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async geocode(address: string): Promise<GeocodeResult> {
    const normalized = address.trim().replace(/\s+/g, ' ');
    if (normalized.length < 3) {
      throw new BadRequestException('Endereco invalido');
    }
    const cacheKey = `geo:${createHash('sha256').update(normalized.toLowerCase()).digest('hex')}`;
    try {
      const cached = await this.redis.raw.get(cacheKey);
      if (cached) return JSON.parse(cached) as GeocodeResult;
    } catch {
      /* redis optional for geo */
    }

    const provider = this.config.get<string>('GEO_PROVIDER') ?? 'local';
    let result: GeocodeResult;
    if (provider === 'nominatim') {
      result = await this.geocodeNominatim(normalized);
    } else {
      result = this.geocodeLocal(normalized);
    }

    try {
      await this.redis.raw.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        7 * 86400,
      );
    } catch {
      /* ignore */
    }
    return result;
  }

  /** Deterministic coords around Brazil center-ish for offline/dev. */
  geocodeLocal(address: string): GeocodeResult {
    const hash = createHash('sha256').update(address.toLowerCase()).digest();
    const latOffset = ((hash[0] / 255) * 2 - 1) * 0.08;
    const lngOffset = ((hash[1] / 255) * 2 - 1) * 0.08;
    // Default anchor near Cuiabá region-ish; geography still open
    const latitude = Number((-15.601 + latOffset).toFixed(6));
    const longitude = Number((-56.097 + lngOffset).toFixed(6));
    return {
      latitude,
      longitude,
      formattedAddress: address,
      provider: 'local',
    };
  }

  private async geocodeNominatim(address: string): Promise<GeocodeResult> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AquiLog/0.1 (local-dev; contact=admin@aquilog.com.br)',
      },
    });
    if (!res.ok) return this.geocodeLocal(address);
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data.length) return this.geocodeLocal(address);
    return {
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon),
      formattedAddress: data[0].display_name,
      provider: 'nominatim',
    };
  }
}

@ApiTags('Geo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Post('geocode')
  geocode(@Body() dto: GeocodeDto) {
    return this.geo.geocode(dto.address);
  }
}

@Module({
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
