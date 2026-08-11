import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryStatus } from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import type { PlatformSettings } from '../settings/settings.module';

/**
 * `DISP-02` — auditoria de 2026-08-10, achado 1 (é a causa raiz do smoke
 * vermelho no CI, run 31443312246): `warnSlowDispatch` só olhava pedidos
 * `REQUESTED`, mas o despacho deixa o pedido em `OFFERED` assim que há
 * oferta pendente — o caso comum, já que o despacho roda logo na criação.
 * O aviso nunca disparava enquanto havia oferta ativa, então o cenário do
 * smoke ("13 s bastam para o job marcar o aviso") nunca via
 * `dispatchWarningAt` preenchido.
 */

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
  dispatchFirstWarningMinutes: 0,
  dispatchPriceBoostPercent: 20,
};

const COURIER_ID = 'courier-1';
const CUSTOMER_ID = 'customer-1';

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return Object.assign(new Delivery(), {
    id: 'delivery-1',
    code: 'AQL-NOTICE1',
    customerId: CUSTOMER_ID,
    createdById: 'user-customer',
    courierId: COURIER_ID,
    status: DeliveryStatus.REQUESTED,
    priceCents: 2500,
    dispatchStartedAt: null,
    dispatchEndedAt: null,
    dispatchEndReason: null,
    dispatchWarningAt: null,
    pickupCode: null,
    pickupCodeAttempts: 0,
    productPhotoUrls: [],
    ...overrides,
  });
}

function buildService(deliveries: Delivery[]) {
  const deliveriesRepo = {
    find: jest.fn(
      (options: {
        where?: {
          status?:
            { _type?: string; _value?: DeliveryStatus[] } | DeliveryStatus;
          dispatchEndReason?: { _type?: string };
          dispatchWarningAt?: { _type?: string };
        };
      }) => {
        const where = options.where ?? {};
        const matchesStatus = (delivery: Delivery) => {
          if (where.status == null) return true;
          if (
            typeof where.status === 'object' &&
            where.status._type === 'in' &&
            Array.isArray(where.status._value)
          ) {
            return where.status._value.includes(delivery.status);
          }
          return delivery.status === where.status;
        };
        // Simula `IsNull()`: só entra na consulta quando o campo real é nulo.
        const matchesIsNull =
          (field: 'dispatchEndReason' | 'dispatchWarningAt') =>
          (delivery: Delivery) => {
            const clause = where[field];
            if (clause == null) return true;
            return delivery[field] == null;
          };
        return Promise.resolve(
          deliveries
            .filter(matchesStatus)
            .filter(matchesIsNull('dispatchEndReason'))
            .filter(matchesIsNull('dispatchWarningAt')),
        );
      },
    ),
    findOneBy: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(
        deliveries.find((delivery) => delivery.id === id) ?? null,
      ),
    ),
    save: jest.fn((value: Delivery) => Promise.resolve(value)),
  };
  const couriers = {
    findOneBy: jest.fn(() =>
      Promise.resolve(
        Object.assign(new Courier(), {
          id: COURIER_ID,
          userId: 'user-courier',
        }),
      ),
    ),
  };
  const eventsRepo = {
    create: (value: unknown) => value,
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const tracking = {
    emitFirstWarning: jest.fn(),
    emitDispatchEnded: jest.fn(),
    emitPriceBoosted: jest.fn(),
    emitDeliveryUpdated: jest.fn(),
  };
  const settings = { get: jest.fn().mockResolvedValue(SETTINGS) };

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
    couriers as never,
    {} as never,
    eventsRepo as never,
    {} as never,
    notifications as never,
    { record: jest.fn().mockResolvedValue(undefined) } as never,
    {
      reserve: jest.fn().mockResolvedValue(null),
      settle: jest.fn().mockResolvedValue(null),
      release: jest.fn().mockResolvedValue(null),
    } as never,
    {} as never,
    {} as never,
    { get: jest.fn(() => undefined) } as never,
    {
      assertAllowedProductPhotoUrl: jest.fn(),
      assertAllowedProofUrl: jest.fn(),
    } as never,
    settings as never,
    tracking as never,
  );
  return { service };
}

describe('DISP-02 — aviso de demora alcança pedido com oferta pendente', () => {
  it('marca dispatchWarningAt em pedido OFFERED, não só REQUESTED', async () => {
    const offered = makeDelivery({
      id: 'delivery-offered',
      status: DeliveryStatus.OFFERED,
      dispatchStartedAt: new Date(Date.now() - 60_000),
    });
    const requested = makeDelivery({
      id: 'delivery-requested',
      status: DeliveryStatus.REQUESTED,
      dispatchStartedAt: new Date(Date.now() - 60_000),
    });
    const { service } = buildService([offered, requested]);

    const warned = await service.warnSlowDispatch();

    expect(warned).toBe(2);
    expect(offered.dispatchWarningAt).not.toBeNull();
    expect(requested.dispatchWarningAt).not.toBeNull();
  });

  it('não avisa pedido com ciclo já encerrado (dispatchEndReason preenchido)', async () => {
    const ended = makeDelivery({
      id: 'delivery-ended',
      status: DeliveryStatus.REQUESTED,
      dispatchStartedAt: new Date(Date.now() - 60_000),
      dispatchEndReason: 'MAX_ROUNDS',
    });
    const { service } = buildService([ended]);

    const warned = await service.warnSlowDispatch();

    expect(warned).toBe(0);
    expect(ended.dispatchWarningAt).toBeNull();
  });
});
