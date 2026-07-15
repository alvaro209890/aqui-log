import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get(AppController);
  });

  it('reports a healthy API', () => {
    expect(controller.health()).toMatchObject({
      service: 'Aqui Log API',
      status: 'ok',
    });
  });
});
