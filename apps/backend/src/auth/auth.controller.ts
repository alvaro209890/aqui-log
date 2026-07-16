import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterCompanyDto,
  RegisterCourierDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';

@ApiTags('Autenticacao')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('register/company')
  registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.auth.registerCompany(dto);
  }

  @Post('register/courier')
  registerCourier(@Body() dto: RegisterCourierDto) {
    return this.auth.registerCourier(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Req() request: Request & { user: AuthenticatedUser }) {
    return request.user;
  }
}
