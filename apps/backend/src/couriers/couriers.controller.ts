import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsLatitude, IsLongitude } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { CouriersService } from './couriers.service';

class AvailabilityDto {
  @IsBoolean()
  available!: boolean;
}

class CourierLocationDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

@ApiTags('Entregadores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.couriers.findAll(page, limit);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  approve(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.couriers.approve(id, request.user.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  reject(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.couriers.reject(id, request.user.id);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  suspend(
    @Param('id') id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.couriers.suspend(id, request.user.id);
  }

  @Patch('me/availability')
  @Roles(UserRole.COURIER)
  availability(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: AvailabilityDto,
  ) {
    return this.couriers.setAvailability(request.user.id, dto.available);
  }

  @Patch('me/location')
  @Roles(UserRole.COURIER)
  location(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CourierLocationDto,
  ) {
    return this.couriers.updateLocation(
      request.user.id,
      dto.latitude,
      dto.longitude,
    );
  }
}
