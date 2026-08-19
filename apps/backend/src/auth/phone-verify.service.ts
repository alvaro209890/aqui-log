import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Customer } from '../database/entities/customer.entity';
import type { AuthenticatedUser } from './jwt.strategy';
import {
  PHONE_CODE_TTL_MINUTES,
  challengeCooldownSecondsLeft,
  generatePhoneCode,
  hashPhoneCode,
  isPhoneChallengeBlocked,
  maskPhone,
  normalizePhoneE164,
  phoneCodeMatches,
  registerPhoneVerifyFailure,
  shouldRevealDevCode,
} from './phone-verify';

@Injectable()
export class PhoneVerifyService {
  private readonly logger = new Logger(PhoneVerifyService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async challenge(user: AuthenticatedUser, phoneRaw?: string) {
    const customer = await this.requireCustomer(user);
    const now = new Date();
    if (isPhoneChallengeBlocked(customer.phoneChallengeBlockedUntil, now)) {
      throw new HttpException(
        'Muitas tentativas. Aguarde alguns minutos para pedir um codigo novo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const cooldown = challengeCooldownSecondsLeft(
      customer.phoneChallengeSentAt,
      now,
    );
    if (cooldown > 0) {
      throw new HttpException(
        `Aguarde ${cooldown}s para pedir outro codigo`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (phoneRaw != null && phoneRaw.trim() !== '') {
      const next = normalizePhoneE164(phoneRaw);
      if (!next) {
        throw new BadRequestException('Informe um celular valido com DDD');
      }
      if (next !== customer.phone) {
        customer.phone = next;
        customer.phoneVerifiedAt = null;
      }
    }

    const code = generatePhoneCode();
    customer.phoneChallengeHash = hashPhoneCode(code);
    customer.phoneChallengeExpiresAt = new Date(
      now.getTime() + PHONE_CODE_TTL_MINUTES * 60_000,
    );
    customer.phoneChallengeAttempts = 0;
    customer.phoneChallengeSentAt = now;
    await this.customers.save(customer);

    const reveal = shouldRevealDevCode(
      this.config.get('NODE_ENV'),
      this.config.get('PHONE_VERIFY_ADAPTER'),
    );
    if (reveal) {
      this.logger.log(
        `[phone-verify] to=${customer.phone} code=${code} (adapter local; nunca em producao)`,
      );
    }

    await this.audit.record({
      actorId: user.id,
      action: 'PHONE_CHALLENGE_SENT',
      resourceType: 'customer',
      resourceId: customer.id,
      metadata: { phone: maskPhone(customer.phone), revealed: reveal },
    });

    return {
      ok: true,
      phone: maskPhone(customer.phone),
      expiresAt: customer.phoneChallengeExpiresAt.toISOString(),
      cooldownSeconds: 60,
      ...(reveal ? { devCode: code } : {}),
    };
  }

  async verify(user: AuthenticatedUser, code: string) {
    const customer = await this.requireCustomer(user);
    const now = new Date();
    if (isPhoneChallengeBlocked(customer.phoneChallengeBlockedUntil, now)) {
      throw new HttpException(
        'Muitas tentativas erradas. Aguarde para tentar de novo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      !customer.phoneChallengeHash ||
      !customer.phoneChallengeExpiresAt ||
      customer.phoneChallengeExpiresAt.getTime() <= now.getTime()
    ) {
      throw new BadRequestException(
        'Peca um codigo novo: este expirou ou nao foi gerado',
      );
    }
    if (!phoneCodeMatches(customer.phoneChallengeHash, code)) {
      const failure = registerPhoneVerifyFailure(
        customer.phoneChallengeAttempts,
        now,
      );
      customer.phoneChallengeAttempts = failure.attempts;
      customer.phoneChallengeBlockedUntil = failure.blockedUntil;
      await this.customers.save(customer);
      if (failure.blockedNow) {
        throw new HttpException(
          'Muitas tentativas erradas. Aguarde para pedir um codigo novo.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException(
        `Codigo invalido. Restam ${failure.attemptsLeft} tentativas`,
      );
    }

    customer.phoneVerifiedAt = now;
    customer.phoneChallengeHash = null;
    customer.phoneChallengeExpiresAt = null;
    customer.phoneChallengeAttempts = 0;
    customer.phoneChallengeBlockedUntil = null;
    await this.customers.save(customer);

    await this.audit.record({
      actorId: user.id,
      action: 'PHONE_VERIFIED',
      resourceType: 'customer',
      resourceId: customer.id,
      metadata: { phone: maskPhone(customer.phone) },
    });

    return {
      ok: true,
      phoneVerified: true,
      phone: maskPhone(customer.phone),
    };
  }

  async isCustomerVerified(customerId: string): Promise<boolean> {
    const customer = await this.customers.findOneBy({ id: customerId });
    return customer?.phoneVerifiedAt != null;
  }

  private async requireCustomer(user: AuthenticatedUser) {
    if (!user.customerId) {
      throw new ForbiddenException(
        'So o cliente confirma telefone por este fluxo',
      );
    }
    const customer = await this.customers.findOneBy({ id: user.customerId });
    if (!customer) throw new NotFoundException('Cliente nao encontrado');
    return customer;
  }
}
