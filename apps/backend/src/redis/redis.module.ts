import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get raw(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  /** SET key value NX EX ttlSeconds — true if acquired. */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new Redis(url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          lazyConnect: false,
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
