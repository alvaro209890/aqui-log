import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryOffer } from '../database/entities/delivery-offer.entity';
import {
  AccountStatus,
  DeliveryStatus,
  OfferStatus,
  UserRole,
} from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import type { PlatformSettings } from '../settings/settings.module';

/**
 * COUR-02 — cancelamento do prestador com taxa, repositórios de mentira.
 *
 * O que se prova aqui: a janela (status + cutoff), o débito no ledger, a
 * recusa com saldo insuficiente (pedido intacto), a volta a `REQUESTED` sem
 * soltar a reserva do cliente, a exclusão do desistente no redespacho, e o
 * bloqueio do atalho `PATCH .../status CANCELED` (cancelaria de graça).
 */

const DELIVERY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PICKUP = { latitude: -15.6, longitude: -56.1 };

const SETTINGS: PlatformSettings = {
  offerTtlSeconds: 120,
  pricingBaseFeeCents: 700,
  pricingPerKmCents: 250,
  pricingPlatformFeePercent: 20,
  pricingMinFeeCents: 900,
  pricingPerKmImmediateCents: 250,
  pricingPerKmScheduledCents: 180,
  pricingWeightBands: [{ upToKg: 2, surchargeCents: 0 }],
  pricingAboveTopBandCents: 1500,
  pricingSizeSurchargeCents: { SMALL: 0, MEDIUM: 150, LARGE: 400 },
  courierCancelFeeCents: 300,
  courierCancelCutoffMinutesImmediate: 5,
  courierCancelCutoffMinutesScheduled: 60,
  customerCancelFeeCents: 0,
  minScheduleLeadMinutes: 30,
  scheduleMaxWindowMinutes: 480,
  scheduleCapacitySlackMinutes: 15,
  immediateExecutionEstimateMinutes: 45,
  dispatchInitialRadiusKm: 3,
  dispatchRingIncrementKm: 3,
  dispatchMaxRounds: 4,
  dispatchTotalDurationMinutes: 20,
  dispatchFirstWarningMinutes: 5,
  dispatchPriceBoostPercent: 20,
};

function courierUserFor(id: string): AuthenticatedUser {
  return {
    id: `user-${id}`,
    email: `${id}@aquilog.test`,
    role: UserRole.COURIER,
    customerId: null,
  };
}

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  email: 'admin@aquilog.test',
  role: UserRole.ADMIN,
  customerId: null,
};

function courierAt(id: string, km: number): Courier {
  return Object.assign(new Courier(), {
    id,
    userId: `user-${id}`,
    status: AccountStatus.ACTIVE,
    available: true,
    lastLatitude: PICKUP.latitude + km / 111.195,
    lastLongitude: PICKUP.longitude,
  });
}

type HarnessOptions = {
  couriers: Courier[];
  delivery?: Partial<Delivery>;
  debit?: () => Promise<unknown>;
};

type Harness = {
  service: DeliveriesService;
  delivery: Delivery;
  offers: DeliveryOffer[];
  couriers: Courier[];
  finance: {
    debitCourierCancelFee: jest.Mock;
    release: jest.Mock;
  };
  audit: { record: jest.Mock };
};

function buildHarness(options: HarnessOptions): Harness {
  const couriers = options.couriers;
  const offers: DeliveryOffer[] = [];
  const events: Array<{ note: string | null }> = [];
  const delivery = Object.assign(new Delivery(), {
    id: DELIVERY_ID,
    code: 'AQL-COUR02',
    customerId: 'customer-1',
    createdById: 'user-customer',
    courierId: 'perto',
    status: DeliveryStatus.ACCEPTED,
    pickupLatitude: PICKUP.latitude,
    pickupLongitude: PICKUP.longitude,
    deliveryLatitude: PICKUP.latitude + 0.01,
    deliveryLongitude: PICKUP.longitude + 0.01,
    fulfillmentMode: 'IMMEDIATE',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    productPhotoUrls: [],
    pickupCode: '4242',
    pickupCodeAttempts: 0,
    pickupCodeBlockedUntil: null,
    pickupCodeVerifiedAt: null,
    courierCancelFeeCents: 300,
    acceptedAt: new Date(),
    dispatchRound: 1,
    dispatchStartedAt: new Date(),
    dispatchEndedAt: new Date(),
    dispatchEndReason: 'ACCEPTED',
    priceCents: 1380,
    courierFeeCents: 1104,
    ...options.delivery,
  });

  const accepted = Object.assign(new DeliveryOffer(), {
    id: 'offer-accepted',
    deliveryId: DELIVERY_ID,
    courierId: delivery.courierId,
    status: OfferStatus.ACCEPTED,
    expiresAt: new Date(Date.now() + 60_000),
  });
  offers.push(accepted);

  const deliveriesRepo = {
    create: (value: Partial<Delivery>) => Object.assign(new Delivery(), value),
    save: jest.fn((value: Delivery) => Promise.resolve(value)),
    find: jest.fn(() => Promise.resolve([])),
    findOneBy: jest.fn(() => Promise.resolve(delivery)),
    findBy: jest.fn(() => Promise.resolve([])),
  };
  const couriersRepo = {
    findBy: jest.fn(() =>
      Promise.resolve(
        couriers.filter(
          (courier) =>
            courier.status === AccountStatus.ACTIVE && courier.available,
        ),
      ),
    ),
    findOneBy: jest.fn(({ userId, id }: { userId?: string; id?: string }) =>
      Promise.resolve(
        couriers.find(
          (courier) =>
            (userId != null && courier.userId === userId) ||
            (id != null && courier.id === id),
        ) ?? null,
      ),
    ),
    save: jest.fn((value: Courier) => Promise.resolve(value)),
    update: jest.fn((_id: string, patch: Partial<Courier>) => {
      const target = couriers.find((c) => c.id === _id);
      if (target && patch.available != null) target.available = patch.available;
      return Promise.resolve(undefined);
    }),
  };
  const offersRepo = {
    create: (value: Partial<DeliveryOffer>) =>
      Object.assign(new DeliveryOffer(), value),
    save: jest.fn((value: DeliveryOffer) => {
      if (!value.id) value.id = `offer-${offers.length + 1}`;
      if (!offers.includes(value)) offers.push(value);
      return Promise.resolve(value);
    }),
    findBy: jest.fn((where: { deliveryId?: string; status?: OfferStatus }) =>
      Promise.resolve(
        offers.filter(
          (offer) =>
            (where.deliveryId == null ||
              offer.deliveryId === where.deliveryId) &&
            (where.status == null || offer.status === where.status),
        ),
      ),
    ),
    find: jest.fn(() => Promise.resolve(offers)),
    findOneBy: jest.fn(),
    createQueryBuilder: () => ({
      update: () => ({
        set: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({ execute: () => Promise.resolve(undefined) }),
            }),
          }),
        }),
      }),
    }),
  };
  const eventsRepo = {
    create: (value: { note: string | null }) => value,
    save: jest.fn((value: { note: string | null }) => {
      events.push(value);
      return Promise.resolve(value);
    }),
  };
  const finance = {
    reserve: jest.fn().mockResolvedValue(null),
    settle: jest.fn().mockResolvedValue(null),
    release: jest.fn().mockResolvedValue(null),
    debitCourierCancelFee: jest.fn(
      options.debit ?? (() => Promise.resolve({ id: 'txn-fee' })),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const dataSource = {
    transaction: jest.fn((fn: (manager: unknown) => Promise<unknown>) =>
      fn({
        save: (entity: unknown) => {
          const repoSave = (
            deliveriesRepo as { save?: (entity: unknown) => Promise<unknown> }
          ).save;
          return repoSave ? repoSave(entity) : Promise.resolve(entity);
        },
        create: (_entityClass: unknown, data: unknown) => data,
      }),
    ),
  } as never;
  const service = new DeliveriesService(
    dataSource,
    deliveriesRepo as never,
    couriersRepo as never,
    offersRepo as never,
    eventsRepo as never,
    {} as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    audit as never,
    finance as never,
    {} as never,
    {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    } as never,
    { get: jest.fn(() => undefined) } as never,
    {
      assertAllowedProductPhotoUrl: jest.fn(),
      assertAllowedProofUrl: jest.fn(),
    } as never,
    { get: jest.fn(() => Promise.resolve(SETTINGS)) } as never,
    {
      emitFirstWarning: jest.fn(),
      emitDispatchEnded: jest.fn(),
      emitPriceBoosted: jest.fn(),
      emitDeliveryUpdated: jest.fn(),
    } as never,
  );
  return { service, delivery, offers, couriers, finance, audit };
}

describe('COUR-02 — cancelamento do prestador', () => {
  it('dentro do cutoff: volta a REQUESTED, debita a taxa e nao solta a reserva', async () => {
    const perto = courierAt('perto', 0.4);
    perto.available = false;
    const longe = courierAt('longe', 0.8);
    const h = buildHarness({ couriers: [perto, longe] });

    await h.service.cancelByCourier(DELIVERY_ID, courierUserFor('perto'));

    expect(h.delivery.status).toBe(DeliveryStatus.OFFERED);
    expect(h.delivery.courierId).toBe('longe');
    expect(h.finance.debitCourierCancelFee).toHaveBeenCalled();
    expect(h.finance.release).not.toHaveBeenCalled();
    expect(perto.available).toBe(true);
    expect(h.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COURIER_CANCELED' }),
    );
    // Quem desistiu ja tem oferta (ACCEPTED); o redespacho vai para o outro.
    expect(
      h.offers.some(
        (offer) =>
          offer.courierId === 'longe' && offer.status === OfferStatus.PENDING,
      ),
    ).toBe(true);
  });

  it('saldo insuficiente recusa e deixa o pedido ACCEPTED', async () => {
    const perto = courierAt('perto', 0.4);
    const h = buildHarness({
      couriers: [perto],
      debit: () =>
        Promise.reject(
          new ConflictException(
            'Saldo insuficiente para a taxa de cancelamento. O cancelamento foi recusado.',
          ),
        ),
    });

    await expect(
      h.service.cancelByCourier(DELIVERY_ID, courierUserFor('perto')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.delivery.status).toBe(DeliveryStatus.ACCEPTED);
    expect(h.delivery.courierId).toBe('perto');
    expect(h.finance.release).not.toHaveBeenCalled();
  });

  it('depois da coleta (AT_PICKUP) recusa', async () => {
    const h = buildHarness({
      couriers: [courierAt('perto', 0.4)],
      delivery: { status: DeliveryStatus.AT_PICKUP },
    });
    await expect(
      h.service.cancelByCourier(DELIVERY_ID, courierUserFor('perto')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.finance.debitCourierCancelFee).not.toHaveBeenCalled();
    expect(h.delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('agendado dentro do cutoff de 60 min da janela recusa', async () => {
    const h = buildHarness({
      couriers: [courierAt('perto', 0.4)],
      delivery: {
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: new Date(Date.now() + 45 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 105 * 60_000),
      },
    });
    await expect(
      h.service.cancelByCourier(DELIVERY_ID, courierUserFor('perto')),
    ).rejects.toThrow(/Fora do prazo/);
    expect(h.finance.debitCourierCancelFee).not.toHaveBeenCalled();
  });

  it('outro entregador nao cancela a corrida alheia', async () => {
    const h = buildHarness({
      couriers: [courierAt('perto', 0.4), courierAt('longe', 0.8)],
    });
    await expect(
      h.service.cancelByCourier(DELIVERY_ID, courierUserFor('longe')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PATCH status CANCELED pelo entregador e recusado (teria cancelado de graca)', async () => {
    const h = buildHarness({ couriers: [courierAt('perto', 0.4)] });
    await expect(
      h.service.updateStatus(
        DELIVERY_ID,
        { status: DeliveryStatus.CANCELED },
        courierUserFor('perto'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.delivery.status).toBe(DeliveryStatus.ACCEPTED);
    expect(h.finance.release).not.toHaveBeenCalled();
  });

  it('admin ainda pode CANCELED (cancela o pedido de verdade)', async () => {
    const h = buildHarness({ couriers: [courierAt('perto', 0.4)] });
    await h.service.updateStatus(
      DELIVERY_ID,
      { status: DeliveryStatus.CANCELED },
      adminUser,
    );
    expect(h.delivery.status).toBe(DeliveryStatus.CANCELED);
    expect(h.finance.release).toHaveBeenCalled();
  });

  it('taxa zero ainda cancela (ledger e no-op)', async () => {
    const perto = courierAt('perto', 0.4);
    const h = buildHarness({
      couriers: [perto, courierAt('longe', 0.8)],
      delivery: { courierCancelFeeCents: 0 },
    });
    await h.service.cancelByCourier(DELIVERY_ID, courierUserFor('perto'));
    expect(h.delivery.courierId).not.toBe('perto');
    expect(h.finance.debitCourierCancelFee).toHaveBeenCalled();
  });

  it('present() do detalhe marca courierCancelAllowed no ACCEPTED dentro da janela', async () => {
    const h = buildHarness({ couriers: [courierAt('perto', 0.4)] });
    const view = (await h.service.findOne(
      DELIVERY_ID,
      courierUserFor('perto'),
    )) as {
      courierCancelAllowed: boolean;
      courierCancelUntil: string | null;
      pickupCode?: string;
    };
    expect(view.courierCancelAllowed).toBe(true);
    expect(view.courierCancelUntil).toEqual(expect.any(String));
    expect(view.pickupCode).toBeUndefined();
  });
});
