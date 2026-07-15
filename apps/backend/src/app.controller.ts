import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Sistema')
@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      service: 'Aqui Log API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
