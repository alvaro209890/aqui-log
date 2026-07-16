import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { APP_TIMEZONE } from './common/timezone';
import { RedisService } from './redis/redis.module';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(
    private readonly redis: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async health() {
    let redis: 'ok' | 'down' = 'down';
    let db: 'ok' | 'down' = 'down';
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') redis = 'ok';
    } catch {
      redis = 'down';
    }
    try {
      await this.dataSource.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
    const status = redis === 'ok' && db === 'ok' ? 'ok' : 'degraded';
    return {
      service: 'Aqui Log API',
      status,
      timezone: APP_TIMEZONE,
      checks: { db, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
