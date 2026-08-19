import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ChallengePhoneDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterCourierDto,
  RegisterCustomerDto,
  ResetPasswordDto,
  VerifyPhoneDto,
} from './dto/auth.dto';
import { PhoneVerifyService } from './phone-verify.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../database/enums';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';

@ApiTags('Autenticacao')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly phone: PhoneVerifyService,
  ) {}

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

  @Post('register/courier')
  registerCourier(@Body() dto: RegisterCourierDto) {
    return this.auth.registerCourier(dto);
  }

  @Post('register/customer')
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.auth.registerCustomer(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.auth.me(request.user);
  }

  /**
   * B2C-04 / DEC-04 — pede um código de verificação para o telefone do
   * cliente. Sem SMS: em local o adapter revela `devCode`; em produção o
   * campo não existe.
   */
  @Post('phone/challenge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  challengePhone(
    @Body() dto: ChallengePhoneDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.phone.challenge(request.user, dto?.phone);
  }

  @Post('phone/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  verifyPhone(
    @Body() dto: VerifyPhoneDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.phone.verify(request.user, dto.code);
  }
}
