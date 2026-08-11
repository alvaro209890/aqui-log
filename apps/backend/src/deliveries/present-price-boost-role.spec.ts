import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryStatus, UserRole } from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import type { PlatformSettings } from '../settings/settings.module';

/**
 * `DISP-02` — auditoria de 2026-08-10, achado 2: `present()` calculava
 * `priceBoostProposal` antes do corte por papel do motoboy (o `return shared`
 * antecipado do `COURIER`), então o app do entregador recebia a proposta de
 * aumento que só deveria existir para o cliente — abrindo espaço para recusa
 * estratégica (recusar de propósito para forçar o valor subir e ganhar mais).
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

const courierUser: AuthenticatedUser = {
  id: 'user-courier',
  email: 'motoboy@aquilog.test',
  role: UserRole.COURIER,
  customerId: null,
};

const customerUser: AuthenticatedUser = {
  id: 'user-customer',
  email: 'cliente@aquilog.test',
  role: UserRole.CUSTOMER,
  customerId: CUSTOMER_ID,
};

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return Object.assign(new Delivery(), {
    id: 'delivery-1',
    code: 'AQL-BOOST1',
    customerId: CUSTOMER_ID,
    createdById: customerUser.id,
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

function buildService(delivery: Delivery) {
  const deliveriesRepo = {
    findOneBy: jest.fn().mockResolvedValue(delivery),
  };
  const couriers = {
    findOneBy: jest.fn(() =>
      Promise.resolve(
        Object.assign(new Courier(), {
          id: COURIER_ID,
          userId: courierUser.id,
        }),
      ),
    ),
  };
  const settings = { get: jest.fn().mockResolvedValue(SETTINGS) };

  const service = new DeliveriesService(
    deliveriesRepo as never,
    couriers as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { get: jest.fn(() => undefined) } as never,
    {} as never,
    settings as never,
    {} as never,
  );
  return { service };
}

describe('DISP-02 — priceBoostProposal nunca vai para o motoboy', () => {
  it('present() (via findOne) omite priceBoostProposal e pickupCode para COURIER', async () => {
    const delivery = makeDelivery({
      status: DeliveryStatus.REQUESTED,
      dispatchEndReason: 'MAX_ROUNDS',
    });
    const { service } = buildService(delivery);

    const asCourier = await service.findOne(delivery.id, courierUser);
    expect(asCourier).not.toHaveProperty('priceBoostProposal');
    expect(asCourier).not.toHaveProperty('pickupCode');
  });

  it('present() mantém priceBoostProposal preenchido para o CUSTOMER', async () => {
    const delivery = makeDelivery({
      status: DeliveryStatus.REQUESTED,
      dispatchEndReason: 'MAX_ROUNDS',
    });
    const { service } = buildService(delivery);

    const asCustomer = await service.findOne(delivery.id, customerUser);
    expect(asCustomer).toHaveProperty('priceBoostProposal');
    expect(
      (asCustomer as { priceBoostProposal: { newPriceCents: number } | null })
        .priceBoostProposal,
    ).not.toBeNull();
  });
});
