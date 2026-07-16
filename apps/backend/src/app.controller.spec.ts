import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { RedisService } from './redis/redis.module';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: RedisService,
          useValue: {
            ping: () => Promise.resolve('PONG'),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: () => Promise.resolve([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    controller = module.get(AppController);
  });

  it('reports a healthy API when db and redis respond', async () => {
    await expect(controller.health()).resolves.toMatchObject({
      service: 'Aqui Log API',
      status: 'ok',
      checks: { db: 'ok', redis: 'ok' },
    });
  });
});
