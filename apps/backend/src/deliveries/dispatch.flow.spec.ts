import { ConflictException, NotFoundException } from '@nestjs/common';
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
 * DISP-01 — o ciclo de reoferta com repositórios de mentira.
 *
 * O que se prova aqui: quem recusou ou deixou expirar não recebe a mesma
 * corrida de novo, o raio cresce a cada rodada, o ciclo para no limite de
 * rodadas ou de tempo, o pedido continua recuperável ao parar, e job repetido
 * não cria duas ofertas para a mesma rodada.
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
};

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  email: 'admin@aquilog.test',
  role: UserRole.ADMIN,
  customerId: null,
};

/** ~111 km por grau de latitude: desloca o motoboy `km` ao norte da coleta. */
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
  lockAvailable?: boolean;
};

type Harness = {
  service: DeliveriesService;
  delivery: Delivery;
  offers: DeliveryOffer[];
  couriers: Courier[];
  events: Array<{ note: string | null }>;
};

function buildHarness(options: HarnessOptions): Harness {
  const couriers = options.couriers;
  const offers: DeliveryOffer[] = [];
  const events: Array<{ note: string | null }> = [];
  const delivery = Object.assign(new Delivery(), {
    id: DELIVERY_ID,
    code: 'AQL-DISP01',
    customerId: 'customer-1',
    createdById: 'user-customer',
    courierId: null,
    status: DeliveryStatus.REQUESTED,
    pickupLatitude: PICKUP.latitude,
    pickupLongitude: PICKUP.longitude,
    deliveryLatitude: PICKUP.latitude + 0.01,
    deliveryLongitude: PICKUP.longitude + 0.01,
    fulfillmentMode: 'IMMEDIATE',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    productPhotoUrls: [],
    pickupCode: null,
    pickupCodeAttempts: 0,
    pickupCodeBlockedUntil: null,
    pickupCodeVerifiedAt: null,
    courierCancelFeeCents: null,
    dispatchRound: null,
    dispatchStartedAt: null,
    dispatchEndedAt: null,
    dispatchEndReason: null,
    ...options.delivery,
  });

  const deliveriesRepo = {
    create: (value: Partial<Delivery>) => Object.assign(new Delivery(), value),
    save: jest.fn((value: Delivery) => Promise.resolve(value)),
    // Só a consulta de capacidade usa `find` neste teste (nada reservado).
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
    findOneBy: jest.fn(({ userId }: { userId?: string }) =>
      Promise.resolve(
        couriers.find((courier) => courier.userId === userId) ?? null,
      ),
    ),
    save: jest.fn((value: Courier) => Promise.resolve(value)),
    update: jest.fn(() => Promise.resolve(undefined)),
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
    findOneBy: jest.fn(
      (where: { id?: string; courierId?: string; status?: OfferStatus }) =>
        Promise.resolve(
          offers.find(
            (offer) =>
              (where.id == null || offer.id === where.id) &&
              (where.courierId == null ||
                offer.courierId === where.courierId) &&
              (where.status == null || offer.status === where.status),
          ) ?? null,
        ),
    ),
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
    { record: jest.fn().mockResolvedValue(undefined) } as never,
    {
      reserve: jest.fn().mockResolvedValue(null),
      settle: jest.fn().mockResolvedValue(null),
      release: jest.fn().mockResolvedValue(null),
    } as never,
    {} as never,
    {
      acquireLock: jest.fn().mockResolvedValue(options.lockAvailable ?? true),
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
  return { service, delivery, offers, couriers, events };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe('DISP-01 — primeira rodada', () => {
  it('oferta ao mais próximo dentro do anel inicial e registra a rodada', async () => {
    const h = buildHarness({
      couriers: [courierAt('longe', 2.5), courierAt('perto', 0.5)],
    });

    await h.service.dispatch(DELIVERY_ID, adminUser.id);

    expect(h.offers).toHaveLength(1);
    expect(h.offers[0].courierId).toBe('perto');
    expect(h.offers[0].dispatchRound).toBe(1);
    expect(h.offers[0].radiusKm).toBe(3);
    expect(h.offers[0].eligibleCount).toBe(2);
    expect(h.offers[0].attemptedCount).toBe(1);
    expect(h.delivery.status).toBe(DeliveryStatus.OFFERED);
    expect(h.delivery.dispatchRound).toBe(1);
    expect(h.delivery.dispatchStartedAt).not.toBeNull();
    expect(h.delivery.dispatchEndReason).toBeNull();
  });

  it('ignora quem está fora do último anel e não consome rodada', async () => {
    const h = buildHarness({ couriers: [courierAt('longissimo', 40)] });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      NotFoundException,
    );
    expect(h.offers).toHaveLength(0);
    expect(h.delivery.status).toBe(DeliveryStatus.REQUESTED);
    // O ciclo COMEÇOU (é o relógio da duração total), mas nenhuma rodada foi
    // gasta: anel vazio não pode queimar o limite em 10 segundos.
    expect(h.delivery.dispatchStartedAt).not.toBeNull();
    expect(h.delivery.dispatchRound ?? 0).toBe(0);
    expect(h.delivery.dispatchEndReason).toBeNull();
  });
});

describe('DISP-01 — exclusão de quem já foi tentado (plano §6.1.2)', () => {
  it('recusa não volta para o mesmo motoboy e sobe de anel', async () => {
    const h = buildHarness({
      couriers: [courierAt('primeiro', 0.5), courierAt('segundo', 5)],
    });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);
    const courierUser: AuthenticatedUser = {
      id: 'user-primeiro',
      email: 'primeiro@aquilog.test',
      role: UserRole.COURIER,
      customerId: null,
    };

    await h.service.rejectOffer(h.offers[0].id, courierUser);

    expect(h.offers).toHaveLength(2);
    expect(h.offers[0].status).toBe(OfferStatus.REJECTED);
    // O segundo está a 5 km: fora do anel 1 (3 km), dentro do anel 2 (6 km).
    expect(h.offers[1].courierId).toBe('segundo');
    expect(h.offers[1].dispatchRound).toBe(2);
    expect(h.offers[1].radiusKm).toBe(6);
    expect(h.offers[1].attemptedCount).toBe(2);
    expect(h.delivery.dispatchRound).toBe(2);
  });

  it('expiração também exclui, e sem candidato novo o pedido volta a REQUESTED', async () => {
    const h = buildHarness({ couriers: [courierAt('unico', 0.5)] });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);
    h.offers[0].expiresAt = minutesAgo(5);

    await h.service.expireStaleOffers();

    expect(h.offers[0].status).toBe(OfferStatus.EXPIRED);
    expect(h.offers).toHaveLength(1);
    expect(h.delivery.status).toBe(DeliveryStatus.REQUESTED);
    expect(h.delivery.courierId).toBeNull();
  });

  it('não reoferta ao mesmo motoboy nem quando ele é o único disponível', async () => {
    const h = buildHarness({ couriers: [courierAt('unico', 0.5)] });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);
    h.offers[0].status = OfferStatus.REJECTED;
    h.delivery.status = DeliveryStatus.REQUESTED;
    h.delivery.courierId = null;

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      'Nenhum entregador disponivel com localizacao',
    );
    expect(h.offers).toHaveLength(1);
  });
});

describe('DISP-01 — ampliação por anéis', () => {
  it('pula anéis vazios na mesma chamada e registra o anel usado', async () => {
    const h = buildHarness({ couriers: [courierAt('medio', 8)] });

    await h.service.dispatch(DELIVERY_ID, adminUser.id);

    expect(h.offers[0].dispatchRound).toBe(3);
    expect(h.offers[0].radiusKm).toBe(9);
    expect(h.delivery.dispatchRound).toBe(3);
  });

  it('a rodada seguinte já nasce no anel maior', async () => {
    const h = buildHarness({
      couriers: [courierAt('a', 0.5), courierAt('b', 1)],
      delivery: { dispatchRound: 2, dispatchStartedAt: minutesAgo(1) },
    });

    await h.service.dispatch(DELIVERY_ID, adminUser.id);

    expect(h.offers[0].dispatchRound).toBe(3);
    expect(h.offers[0].radiusKm).toBe(9);
  });
});

describe('DISP-01 — limites e estado recuperável (plano §6.1.5)', () => {
  it('esgotar as rodadas encerra o ciclo e mantém o pedido REQUESTED', async () => {
    const h = buildHarness({
      couriers: [courierAt('disponivel', 0.5)],
      delivery: { dispatchRound: 4, dispatchStartedAt: minutesAgo(2) },
    });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      NotFoundException,
    );

    expect(h.delivery.status).toBe(DeliveryStatus.REQUESTED);
    expect(h.delivery.dispatchEndReason).toBe('MAX_ROUNDS');
    expect(h.delivery.dispatchEndedAt).not.toBeNull();
    expect(h.offers).toHaveLength(0);
  });

  it('estourar a duração total encerra por TIMEBOX quando já houve oferta', async () => {
    const h = buildHarness({
      couriers: [courierAt('disponivel', 0.5)],
      delivery: { dispatchRound: 1, dispatchStartedAt: minutesAgo(21) },
    });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      NotFoundException,
    );

    expect(h.delivery.dispatchEndReason).toBe('TIMEBOX');
    expect(h.delivery.status).toBe(DeliveryStatus.REQUESTED);
  });

  it('estourar a duração sem nenhuma oferta encerra por NO_CANDIDATE', async () => {
    const h = buildHarness({
      couriers: [courierAt('disponivel', 0.5)],
      delivery: { dispatchRound: 0, dispatchStartedAt: minutesAgo(30) },
    });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      NotFoundException,
    );

    expect(h.delivery.dispatchEndReason).toBe('NO_CANDIDATE');
  });

  it('ciclo encerrado não é reaberto pelos jobs automáticos', async () => {
    const h = buildHarness({
      couriers: [courierAt('disponivel', 0.5)],
      delivery: {
        dispatchRound: 4,
        dispatchStartedAt: minutesAgo(5),
        dispatchEndedAt: new Date(),
        dispatchEndReason: 'MAX_ROUNDS',
      },
    });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      ConflictException,
    );
    expect(h.offers).toHaveLength(0);

    // E o job de reoferta ignora o pedido: a consulta filtra por
    // `dispatchEndReason IS NULL`.
    expect(await h.service.redispatchPendingRequested()).toBe(0);
  });

  it('o despacho manual do admin reabre o ciclo esgotado', async () => {
    const h = buildHarness({
      couriers: [courierAt('disponivel', 0.5)],
      delivery: {
        dispatchRound: 4,
        dispatchStartedAt: minutesAgo(40),
        dispatchEndedAt: new Date(),
        dispatchEndReason: 'TIMEBOX',
      },
    });

    await h.service.dispatch(DELIVERY_ID, adminUser.id, { reopen: true });

    expect(h.offers).toHaveLength(1);
    expect(h.offers[0].dispatchRound).toBe(1);
    expect(h.delivery.dispatchEndReason).toBeNull();
    expect(h.delivery.dispatchRound).toBe(1);
  });
});

describe('DISP-01 — concorrência e idempotência (plano §6.2)', () => {
  it('sem o lock, a rodada não acontece e nenhuma oferta é criada', async () => {
    const h = buildHarness({
      couriers: [courierAt('perto', 0.5)],
      lockAvailable: false,
    });

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      ConflictException,
    );
    expect(h.offers).toHaveLength(0);
  });

  it('job repetido não cria segunda oferta: o pedido já saiu de REQUESTED', async () => {
    const h = buildHarness({
      couriers: [courierAt('perto', 0.5), courierAt('outro', 1)],
    });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);

    await expect(h.service.dispatch(DELIVERY_ID, adminUser.id)).rejects.toThrow(
      'A entrega nao esta aguardando despacho',
    );
    expect(h.offers).toHaveLength(1);
    expect(h.delivery.dispatchRound).toBe(1);
  });
});

describe('DISP-01 — desfecho do ciclo', () => {
  it('o aceite fecha o ciclo com ACCEPTED', async () => {
    const h = buildHarness({ couriers: [courierAt('perto', 0.5)] });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);
    const courierUser: AuthenticatedUser = {
      id: 'user-perto',
      email: 'perto@aquilog.test',
      role: UserRole.COURIER,
      customerId: null,
    };
    h.delivery.status = DeliveryStatus.OFFERED;

    await h.service.acceptOffer(h.offers[0].id, courierUser);

    expect(h.delivery.status).toBe(DeliveryStatus.ACCEPTED);
    expect(h.delivery.dispatchEndReason).toBe('ACCEPTED');
    expect(h.delivery.dispatchEndedAt).not.toBeNull();
  });

  it('a reoferta usa o snapshot: nenhuma rodada mexe no preço (DEC-03/DEC-19)', async () => {
    const h = buildHarness({
      couriers: [courierAt('primeiro', 0.5), courierAt('segundo', 5)],
      delivery: {
        priceCents: 1380,
        courierFeeCents: 1104,
        kmRateCents: 250,
        pricingVersion: 2,
      },
    });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);

    await h.service.rejectOffer(h.offers[0].id, {
      id: 'user-primeiro',
      email: 'primeiro@aquilog.test',
      role: UserRole.COURIER,
      customerId: null,
    });

    expect(h.delivery.dispatchRound).toBe(2);
    expect(h.delivery.priceCents).toBe(1380);
    expect(h.delivery.courierFeeCents).toBe(1104);
    expect(h.delivery.kmRateCents).toBe(250);
  });

  it('cancelar o pedido encerra a busca', async () => {
    const h = buildHarness({ couriers: [courierAt('perto', 0.5)] });
    await h.service.dispatch(DELIVERY_ID, adminUser.id);
    h.delivery.status = DeliveryStatus.REQUESTED;

    await h.service.updateStatus(
      DELIVERY_ID,
      { status: DeliveryStatus.CANCELED },
      adminUser,
    );

    expect(h.delivery.dispatchEndReason).toBe('CANCELED');
  });
});
