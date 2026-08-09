import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import {
  AccountStatus,
  DeliveryStatus,
  OfferStatus,
  UserRole,
} from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import type { PlatformSettings } from '../settings/settings.module';

/**
 * SCHED-01 / B2C-06 — o caminho do pedido agendado com repositórios de mentira.
 *
 * O que importa aqui é a regra: a janela é obrigatória e validada, o km cobrado
 * muda com o modo, o aceite antecipado não some com o prestador do mercado, a
 * agenda reservada bloqueia oferta que colide e a execução só abre na janela.
 */

const COURIER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COURIER_ID = '33333333-3333-4333-8333-333333333333';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

const customerUser: AuthenticatedUser = {
  id: 'user-customer',
  email: 'cliente@aquilog.test',
  role: UserRole.CUSTOMER,
  customerId: CUSTOMER_ID,
};

const courierUser: AuthenticatedUser = {
  id: 'user-courier',
  email: 'motoboy@aquilog.test',
  role: UserRole.COURIER,
  customerId: null,
};

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  email: 'admin@aquilog.test',
  role: UserRole.ADMIN,
  customerId: null,
};

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
};

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

const basePayload = {
  pickupAddress: 'Rua A, 10',
  pickupLatitude: -15.601,
  pickupLongitude: -56.097,
  deliveryAddress: 'Rua B, 20',
  deliveryLatitude: -15.61,
  deliveryLongitude: -56.11,
  recipientName: 'Maria',
  recipientPhone: '+5565999999999',
  productType: 'ELECTRONICS' as const,
  packageSize: 'MEDIUM' as const,
  weightKg: 1.5,
  productPhotoUrls: ['http://localhost:3001/api/v1/storage/files/a.jpg'],
};

function makeCourier(id: string): Courier {
  return Object.assign(new Courier(), {
    id,
    userId: id === COURIER_ID ? courierUser.id : 'user-outro',
    status: AccountStatus.ACTIVE,
    available: true,
    lastLatitude: -15.6,
    lastLongitude: -56.09,
  });
}

type Harness = {
  service: DeliveriesService;
  saved: Delivery[];
  reserved: Delivery[];
  offersSaved: unknown[];
  couriers: Courier[];
};

function buildHarness(options: { reserved?: Delivery[] } = {}): Harness {
  const saved: Delivery[] = [];
  const reserved = options.reserved ?? [];
  const offersSaved: unknown[] = [];
  const couriers = [makeCourier(COURIER_ID), makeCourier(OTHER_COURIER_ID)];

  const deliveriesRepo = {
    create: (value: Partial<Delivery>) => Object.assign(new Delivery(), value),
    save: jest.fn((value: Delivery) => {
      if (!saved.includes(value)) saved.push(value);
      return Promise.resolve(value);
    }),
    // `find` só é usado pela consulta de capacidade neste teste.
    find: jest.fn(() => Promise.resolve(reserved)),
    findOneBy: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(
        saved.find((item) => item.id === id) ??
          reserved.find((item) => item.id === id) ??
          null,
      ),
    ),
    findBy: jest.fn(() => Promise.resolve([])),
  };
  const couriersRepo = {
    findBy: jest.fn(() => Promise.resolve(couriers)),
    findOneBy: jest.fn(({ userId }: { userId?: string }) =>
      Promise.resolve(
        couriers.find((courier) => courier.userId === userId) ?? couriers[0],
      ),
    ),
    save: jest.fn((value: Courier) => Promise.resolve(value)),
    update: jest.fn(() => Promise.resolve(undefined)),
  };
  const offersRepo = {
    create: (value: unknown) => value,
    save: jest.fn((value: Record<string, unknown>) => {
      const withId = { id: 'offer-1', ...value };
      offersSaved.push(withId);
      return Promise.resolve(withId);
    }),
    findBy: jest.fn(() => Promise.resolve([])),
    findOneBy: jest.fn(() => Promise.resolve(null)),
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
  const events = {
    create: (value: unknown) => value,
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const settings = { get: jest.fn(() => Promise.resolve(SETTINGS)) };
  const pricing = {
    quoteAsync: jest.fn(
      (params: { fulfillmentMode: 'IMMEDIATE' | 'SCHEDULED' }) => {
        const kmRateCents =
          params.fulfillmentMode === 'SCHEDULED'
            ? SETTINGS.pricingPerKmScheduledCents
            : SETTINGS.pricingPerKmImmediateCents;
        return Promise.resolve({
          distanceKm: 2,
          priceCents: 700 + kmRateCents * 2,
          courierFeeCents: 800,
          platformFeeCents: 200,
          pricingVersion: 2,
          breakdown: {
            version: 2,
            fulfillmentMode: params.fulfillmentMode,
            kmRateCents,
          },
        });
      },
    ),
  };
  const service = new DeliveriesService(
    deliveriesRepo as never,
    couriersRepo as never,
    offersRepo as never,
    events as never,
    {} as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    { record: jest.fn().mockResolvedValue(undefined) } as never,
    { creditDelivery: jest.fn() } as never,
    pricing as never,
    {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    } as never,
    {} as never,
    {
      assertAllowedProductPhotoUrl: jest.fn(),
      assertAllowedProofUrl: jest.fn(),
    } as never,
    settings as never,
  );
  return { service, saved, reserved, offersSaved, couriers };
}

describe('SCHED-01 — criação do pedido agendado', () => {
  it('persiste janela, modo e km do agendado', async () => {
    const { service, saved } = buildHarness();
    const start = inMinutes(120);
    const end = inMinutes(180);

    await service.create(
      {
        ...basePayload,
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: start.toISOString(),
        pickupWindowEnd: end.toISOString(),
      },
      customerUser,
    );

    const delivery = saved[0];
    expect(delivery.fulfillmentMode).toBe('SCHEDULED');
    expect(delivery.kmRateCents).toBe(SETTINGS.pricingPerKmScheduledCents);
    expect(delivery.pickupWindowStart?.toISOString()).toBe(start.toISOString());
    expect(delivery.pickupWindowEnd?.toISOString()).toBe(end.toISOString());
    // `scheduledAt` legado acompanha o início da janela, para que o
    // redespacho automático continue funcionando.
    expect(delivery.scheduledAt?.toISOString()).toBe(start.toISOString());
    // A taxa de cancelamento só é congelada no aceite (DEC-20).
    expect(delivery.courierCancelFeeCents).toBeNull();
  });

  it('cobra o km caro no imediato e o barato no agendado (DEC-19)', async () => {
    const immediate = buildHarness();
    await immediate.service.create(
      { ...basePayload, fulfillmentMode: 'IMMEDIATE' },
      customerUser,
    );
    const scheduled = buildHarness();
    await scheduled.service.create(
      {
        ...basePayload,
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: inMinutes(120).toISOString(),
        pickupWindowEnd: inMinutes(180).toISOString(),
      },
      customerUser,
    );

    expect(immediate.saved[0].kmRateCents).toBe(250);
    expect(scheduled.saved[0].kmRateCents).toBe(180);
    expect(scheduled.saved[0].priceCents).toBeLessThan(
      immediate.saved[0].priceCents,
    );
  });

  it('recusa agendado com menos de 30 minutos de antecedência (FLOW-DEC-02)', async () => {
    const { service, saved } = buildHarness();

    await expect(
      service.create(
        {
          ...basePayload,
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: inMinutes(10).toISOString(),
          pickupWindowEnd: inMinutes(70).toISOString(),
        },
        customerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  it('recusa agendado com janela no passado', async () => {
    const { service, saved } = buildHarness();

    await expect(
      service.create(
        {
          ...basePayload,
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: inMinutes(-120).toISOString(),
          pickupWindowEnd: inMinutes(-60).toISOString(),
        },
        customerUser,
      ),
    ).rejects.toThrow(/30 minutos à frente/);
    expect(saved).toHaveLength(0);
  });

  it('recusa agendado sem janela', async () => {
    const { service } = buildHarness();

    await expect(
      service.create(
        { ...basePayload, fulfillmentMode: 'SCHEDULED' },
        customerUser,
      ),
    ).rejects.toThrow(/janela de coleta/i);
  });

  it('imediato não persiste janela nenhuma', async () => {
    const { service, saved } = buildHarness();

    await service.create(
      { ...basePayload, fulfillmentMode: 'IMMEDIATE' },
      customerUser,
    );

    expect(saved[0].pickupWindowStart).toBeNull();
    expect(saved[0].pickupWindowEnd).toBeNull();
  });
});

function makeScheduledDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return Object.assign(new Delivery(), {
    id: 'delivery-agendada',
    code: 'AQL-AGEND1',
    customerId: CUSTOMER_ID,
    createdById: customerUser.id,
    courierId: null,
    status: DeliveryStatus.OFFERED,
    fulfillmentMode: 'SCHEDULED',
    pickupWindowStart: inMinutes(120),
    pickupWindowEnd: inMinutes(180),
    pickupCode: null,
    pickupCodeAttempts: 0,
    pickupCodeBlockedUntil: null,
    pickupCodeVerifiedAt: null,
    courierCancelFeeCents: null,
    courierFeeCents: 800,
    productPhotoUrls: [],
    ...overrides,
  });
}

describe('DEC-20 — aceite antecipado', () => {
  function buildAcceptHarness(delivery: Delivery) {
    const harness = buildHarness();
    const courier = harness.couriers[0];
    const offer = {
      id: 'offer-1',
      deliveryId: delivery.id,
      courierId: courier.id,
      status: OfferStatus.PENDING,
      expiresAt: inMinutes(2),
      respondedAt: null,
    };
    const repos = harness.service as unknown as {
      offers: { findOneBy: jest.Mock };
      deliveries: { findOneBy: jest.Mock };
    };
    repos.offers.findOneBy = jest.fn(() => Promise.resolve(offer));
    repos.deliveries.findOneBy = jest.fn(() => Promise.resolve(delivery));
    return { ...harness, courier, offer };
  }

  it('aceita o agendado logo na criação e congela a taxa de cancelamento', async () => {
    const delivery = makeScheduledDelivery();
    const { service } = buildAcceptHarness(delivery);

    await service.acceptOffer('offer-1', courierUser);

    expect(delivery.status).toBe(DeliveryStatus.ACCEPTED);
    expect(delivery.courierCancelFeeCents).toBe(SETTINGS.courierCancelFeeCents);
    expect(delivery.pickupCode).toMatch(/^\d{4}$/);
  });

  it('não tira o prestador do mercado antes da janela', async () => {
    const delivery = makeScheduledDelivery();
    const { service, courier } = buildAcceptHarness(delivery);

    await service.acceptOffer('offer-1', courierUser);

    expect(courier.available).toBe(true);
  });

  it('o aceite de um imediato continua tirando o prestador do mercado', async () => {
    const delivery = makeScheduledDelivery({
      fulfillmentMode: 'IMMEDIATE',
      pickupWindowStart: null,
      pickupWindowEnd: null,
    });
    const { service, courier } = buildAcceptHarness(delivery);

    await service.acceptOffer('offer-1', courierUser);

    expect(courier.available).toBe(false);
  });

  it('não regrava a taxa em um reaceite', async () => {
    const delivery = makeScheduledDelivery({ courierCancelFeeCents: 250 });
    const { service } = buildAcceptHarness(delivery);

    await service.acceptOffer('offer-1', courierUser);

    expect(delivery.courierCancelFeeCents).toBe(250);
  });
});

describe('plano §5.1 — capacidade do prestador', () => {
  it('exclui do despacho quem tem janela reservada colidindo', async () => {
    const reservada = makeScheduledDelivery({
      id: 'reservada',
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      pickupWindowStart: inMinutes(20),
      pickupWindowEnd: inMinutes(80),
    });
    const imediata = Object.assign(new Delivery(), {
      id: 'imediata',
      code: 'AQL-IMED1',
      status: DeliveryStatus.REQUESTED,
      createdById: customerUser.id,
      fulfillmentMode: 'IMMEDIATE',
      pickupWindowStart: null,
      pickupWindowEnd: null,
      pickupLatitude: -15.6,
      pickupLongitude: -56.09,
      pickupAddress: 'Rua A',
      deliveryAddress: 'Rua B',
    });
    const harness = buildHarness({ reserved: [reservada] });
    (
      harness.service as unknown as { deliveries: { findOneBy: jest.Mock } }
    ).deliveries.findOneBy = jest.fn(() => Promise.resolve(imediata));

    const result = await harness.service.dispatch('imediata', adminUser.id);

    // O prestador com a janela reservada saiu; sobrou o outro.
    expect(result.offer.courierId).toBe(OTHER_COURIER_ID);
  });

  it('recusa o despacho quando ninguém tem agenda livre', async () => {
    const reservadas = [COURIER_ID, OTHER_COURIER_ID].map((courierId, i) =>
      makeScheduledDelivery({
        id: `reservada-${i}`,
        status: DeliveryStatus.ACCEPTED,
        courierId,
        pickupWindowStart: inMinutes(20),
        pickupWindowEnd: inMinutes(80),
      }),
    );
    const imediata = Object.assign(new Delivery(), {
      id: 'imediata',
      code: 'AQL-IMED2',
      status: DeliveryStatus.REQUESTED,
      createdById: customerUser.id,
      fulfillmentMode: 'IMMEDIATE',
      pickupWindowStart: null,
      pickupWindowEnd: null,
      pickupLatitude: -15.6,
      pickupLongitude: -56.09,
    });
    const harness = buildHarness({ reserved: reservadas });
    (
      harness.service as unknown as { deliveries: { findOneBy: jest.Mock } }
    ).deliveries.findOneBy = jest.fn(() => Promise.resolve(imediata));

    await expect(
      harness.service.dispatch('imediata', adminUser.id),
    ).rejects.toThrow(/agenda livre/i);
  });
});

describe('DEC-20 — a execução abre na janela', () => {
  function buildStatusHarness(delivery: Delivery) {
    const harness = buildHarness();
    (
      harness.service as unknown as { deliveries: { findOneBy: jest.Mock } }
    ).deliveries.findOneBy = jest.fn(() => Promise.resolve(delivery));
    return harness;
  }

  it('recusa AT_PICKUP antes do início da janela', async () => {
    const delivery = makeScheduledDelivery({
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      pickupWindowStart: inMinutes(120),
      pickupWindowEnd: inMinutes(180),
    });
    const { service } = buildStatusHarness(delivery);

    await expect(
      service.updateStatus(
        delivery.id,
        { status: DeliveryStatus.AT_PICKUP },
        courierUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(delivery.status).toBe(DeliveryStatus.ACCEPTED);
  });

  it('libera AT_PICKUP quando a janela já começou', async () => {
    const delivery = makeScheduledDelivery({
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      pickupWindowStart: inMinutes(-5),
      pickupWindowEnd: inMinutes(55),
    });
    const { service } = buildStatusHarness(delivery);

    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.AT_PICKUP },
      courierUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('admin passa antes da janela (operação de exceção)', async () => {
    const delivery = makeScheduledDelivery({
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      pickupWindowStart: inMinutes(120),
      pickupWindowEnd: inMinutes(180),
    });
    const { service } = buildStatusHarness(delivery);

    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.AT_PICKUP },
      adminUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('pedido imediato não passa por esse portão', async () => {
    const delivery = makeScheduledDelivery({
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      fulfillmentMode: 'IMMEDIATE',
      pickupWindowStart: null,
      pickupWindowEnd: null,
    });
    const { service } = buildStatusHarness(delivery);

    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.AT_PICKUP },
      courierUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('pedido legado agendado sem janela continua avançando', async () => {
    const delivery = makeScheduledDelivery({
      status: DeliveryStatus.ACCEPTED,
      courierId: COURIER_ID,
      pickupWindowStart: null,
      pickupWindowEnd: null,
    });
    const { service } = buildStatusHarness(delivery);

    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.AT_PICKUP },
      courierUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });
});
