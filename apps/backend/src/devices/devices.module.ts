import {
  Body,
  Controller,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { DeviceToken } from '../database/entities/device-token.entity';

class RegisterDeviceDto {
  @IsString()
  @MinLength(8)
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: string;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokens: Repository<DeviceToken>,
  ) {}

  async register(userId: string, token: string, platform: string) {
    const existing = await this.tokens.findOneBy({ token });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      return this.tokens.save(existing);
    }
    return this.tokens.save(this.tokens.create({ userId, token, platform }));
  }
}

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(
    @Body() dto: RegisterDeviceDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.devices.register(req.user.id, dto.token, dto.platform);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
