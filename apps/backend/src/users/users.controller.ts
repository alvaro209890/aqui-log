import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/enums';
import { CreateCompanyUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_OWNER)
  findAll(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.users.findAll(req.user);
  }

  @Post()
  @Roles(UserRole.COMPANY_OWNER)
  create(
    @Body() dto: CreateCompanyUserDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.users.createCompanyUser(dto, req.user);
  }
}
