import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { Courier } from '../database/entities/courier.entity';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus, UserRole } from '../database/enums';
import { MailService } from '../mail/mail.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterCompanyDto,
  RegisterCourierDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { generateRawToken, hashToken } from './token-crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha invalidos');
    }
    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Cadastro ainda nao aprovado');
    }
    return this.issueTokenPair(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.refreshTokens.findOneBy({ tokenHash });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token invalido ou expirado');
    }
    const user = await this.users.findOneBy({ id: stored.userId });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Usuario indisponivel');
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokenPair(user);
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.refreshTokens.findOneBy({ tokenHash });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokens.save(stored);
    }
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();
    // Always 200 — do not leak account existence
    if (!user) return { ok: true };

    await this.resetTokens.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const raw = generateRawToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.resetTokens.save(
      this.resetTokens.create({
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt,
        usedAt: null,
      }),
    );
    await this.mail.sendPasswordReset(user.email, raw);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashToken(dto.token);
    const stored = await this.resetTokens.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!stored) {
      throw new BadRequestException(
        'Token de recuperacao invalido ou expirado',
      );
    }
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: stored.userId })
      .getOne();
    if (!user) throw new BadRequestException('Usuario nao encontrado');

    user.passwordHash = await hash(dto.password, 12);
    stored.usedAt = new Date();
    await this.users.save(user);
    await this.resetTokens.save(stored);
    // Revoke all refresh tokens
    await this.refreshTokens
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId: user.id })
      .execute();
    return { ok: true };
  }

  async registerCompany(dto: RegisterCompanyDto) {
    await this.ensureEmailAvailable(dto.email);
    return this.dataSource.transaction(async (manager) => {
      const company = await manager.save(
        Company,
        manager.create(Company, {
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          document: dto.document.replace(/\D/g, ''),
          status: AccountStatus.PENDING,
        }),
      );
      const user = await manager.save(
        User,
        manager.create(User, {
          name: dto.ownerName,
          email: dto.email.toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          role: UserRole.COMPANY_OWNER,
          status: AccountStatus.PENDING,
          companyId: company.id,
        }),
      );
      return { id: user.id, companyId: company.id, status: user.status };
    });
  }

  async registerCourier(dto: RegisterCourierDto) {
    await this.ensureEmailAvailable(dto.email);
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        User,
        manager.create(User, {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          role: UserRole.COURIER,
          status: AccountStatus.PENDING,
          companyId: null,
        }),
      );
      const courier = await manager.save(
        Courier,
        manager.create(Courier, {
          userId: user.id,
          document: dto.document.replace(/\D/g, ''),
          vehicleType: dto.vehicleType,
          vehiclePlate: dto.vehiclePlate?.toUpperCase() ?? null,
          documentUrls: dto.documentUrls ?? [],
          status: AccountStatus.PENDING,
        }),
      );
      return { id: user.id, courierId: courier.id, status: user.status };
    });
  }

  private async ensureEmailAvailable(email: string) {
    if (await this.users.findOneBy({ email: email.toLowerCase() })) {
      throw new ConflictException('E-mail ja cadastrado');
    }
  }

  private async issueTokenPair(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
    const rawRefresh = generateRawToken();
    const days = Number(this.config.get('JWT_REFRESH_EXPIRES_DAYS') ?? 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt,
        revokedAt: null,
      }),
    );
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '1d';
    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
