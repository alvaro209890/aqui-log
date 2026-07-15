import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { FinanceService } from './finance.service';

@ApiTags('Financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.COMPANY_OWNER,
    UserRole.COMPANY_USER,
  )
  summary(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.finance.summary(req.user);
  }

  @Get('statement')
  @Roles(UserRole.COURIER)
  statement(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.finance.statement(req.user.id);
  }
}
