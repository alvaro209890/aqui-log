import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
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

@ApiTags('Entregadores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll() {
    return this.couriers.findAll();
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  approve(@Param('id') id: string) {
    return this.couriers.approve(id);
  }

  @Patch('me/availability')
  @Roles(UserRole.COURIER)
  availability(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: AvailabilityDto,
  ) {
    return this.couriers.setAvailability(request.user.id, dto.available);
  }
}
