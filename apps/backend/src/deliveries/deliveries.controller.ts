import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  RateDeliveryDto,
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
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('status') status?: string,
    @Query('company') company?: string,
    @Query('courier') courier?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deliveries.findAll(req.user, {
      status,
      company,
      courier,
      date,
      page,
      limit,
    });
  }

  @Get('ratings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  listRatings() {
    return this.deliveries.listRatings();
  }

  @Get('offers/mine')
  @Roles(UserRole.COURIER)
  findOffers(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.deliveries.findOffers(req.user.id);
  }

  @Get(':id/history')
  history(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.history(id, req.user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.findOne(id, req.user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignCourierDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.assign(id, dto, req.user.id);
  }

  @Post(':id/dispatch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  dispatch(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.dispatch(id, req.user.id);
  }

  @Patch('offers/:offerId/accept')
  @Roles(UserRole.COURIER)
  acceptOffer(
    @Param('offerId') offerId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.acceptOffer(offerId, req.user.id);
  }

  @Patch('offers/:offerId/reject')
  @Roles(UserRole.COURIER)
  rejectOffer(
    @Param('offerId') offerId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.rejectOffer(offerId, req.user.id);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.COURIER,
    UserRole.COMPANY_OWNER,
    UserRole.COMPANY_USER,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.updateStatus(id, dto, req.user);
  }

  @Post(':id/rating')
  @Roles(UserRole.COMPANY_OWNER, UserRole.COMPANY_USER)
  rate(
    @Param('id') id: string,
    @Body() dto: RateDeliveryDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.rate(id, dto, req.user);
  }
}
