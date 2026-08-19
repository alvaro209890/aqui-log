import { BadRequestException, HttpException } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt.strategy';
import { Customer } from '../database/entities/customer.entity';
import { UserRole } from '../database/enums';
import { PhoneVerifyService } from './phone-verify.service';
import { hashPhoneCode } from './phone-verify';

const customerUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'cliente@aquilog.test',
  role: UserRole.CUSTOMER,
  customerId: 'cust-1',
};

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return Object.assign(new Customer(), {
    id: 'cust-1',
    userId: 'user-1',
    document: '12345678901',
    phone: '+5531999999999',
    phoneVerifiedAt: null,
    phoneChallengeHash: null,
    phoneChallengeExpiresAt: null,
    phoneChallengeAttempts: 0,
    phoneChallengeSentAt: null,
    phoneChallengeBlockedUntil: null,
    ...overrides,
  });
}

function buildService(customer: Customer) {
  const customers = {
    findOneBy: jest.fn().mockResolvedValue(customer),
    save: jest.fn((value: Customer) => Promise.resolve(value)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? 'development' : undefined,
    ),
  };
  const service = new PhoneVerifyService(
    customers as never,
    config as never,
    audit as never,
  );
  return { service, customer, audit };
}

describe('B2C-04 — desafio e verificacao de telefone', () => {
  it('em local o adapter revela o codigo e grava o hash', async () => {
    const { service, customer, audit } = buildService(makeCustomer());
    const result = await service.challenge(customerUser);
    expect(result.ok).toBe(true);
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(customer.phoneChallengeHash).toBe(hashPhoneCode(result.devCode!));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PHONE_CHALLENGE_SENT' }),
    );
  });

  it('codigo certo marca phoneVerifiedAt e limpa o desafio', async () => {
    const { service, customer } = buildService(makeCustomer());
    const { devCode } = await service.challenge(customerUser);
    const verified = await service.verify(customerUser, devCode!);
    expect(verified.phoneVerified).toBe(true);
    expect(customer.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(customer.phoneChallengeHash).toBeNull();
  });

  it('codigo errado consome tentativa; 5a bloqueia', async () => {
    const { service } = buildService(makeCustomer());
    await service.challenge(customerUser);
    for (let i = 0; i < 4; i += 1) {
      await expect(
        service.verify(customerUser, '000000'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service.verify(customerUser, '000000')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('trocar o telefone invalida a verificacao anterior', async () => {
    const { service, customer } = buildService(
      makeCustomer({ phoneVerifiedAt: new Date() }),
    );
    await service.challenge(customerUser, '11988887777');
    expect(customer.phone).toBe('+5511988887777');
    expect(customer.phoneVerifiedAt).toBeNull();
  });

  it('reenvio imediato e recusado (cooldown)', async () => {
    const { service } = buildService(makeCustomer());
    await service.challenge(customerUser);
    await expect(service.challenge(customerUser)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('producao nao inclui devCode na resposta', async () => {
    const customer = makeCustomer();
    const customers = {
      findOneBy: jest.fn().mockResolvedValue(customer),
      save: jest.fn((value: Customer) => Promise.resolve(value)),
    };
    const service = new PhoneVerifyService(
      customers as never,
      {
        get: jest.fn((key: string) =>
          key === 'NODE_ENV' ? 'production' : undefined,
        ),
      } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const result = await service.challenge(customerUser);
    expect(result).not.toHaveProperty('devCode');
  });
});
