import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }

  @Get('trends')
  trends() {
    return this.dashboard.trends();
  }

  @Get('charts/deliveries-by-hour')
  deliveriesByHour(@Query('date') date?: string) {
    return this.dashboard.deliveriesByHour(date);
  }

  @Get('charts/deliveries-by-status')
  deliveriesByStatus() {
    return this.dashboard.deliveriesByStatus();
  }

  @Get('performance')
  performance() {
    return this.dashboard.performance();
  }
}
