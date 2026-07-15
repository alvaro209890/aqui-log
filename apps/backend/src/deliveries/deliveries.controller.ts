import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import {
  AssignCourierDto,
  CreateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

@ApiTags('Entregas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Post()
  @Roles(UserRole.COMPANY_OWNER, UserRole.COMPANY_USER)
  create(
    @Body() dto: CreateDeliveryDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.create(dto, req.user);
  }

  @Get()
  findAll(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.deliveries.findAll(req.user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assign(@Param('id') id: string, @Body() dto: AssignCourierDto) {
    return this.deliveries.assign(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COURIER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.deliveries.updateStatus(id, dto);
  }
}
