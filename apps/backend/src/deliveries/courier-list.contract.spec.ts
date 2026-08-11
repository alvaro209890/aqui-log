import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { AccountStatus, DeliveryStatus, UserRole } from '../database/enums';
import { DeliveriesService } from './deliveries.service';

/**
 * COUR-01 / DEC-21 — o contrato de que as seções *Em andamento* e *Agenda*
 * dependem.
 *
 * A separação das duas listas acontece no app, e o critério é
 * `fulfillmentMode` + `pickupWindowStart`. Se a listagem do prestador parar de
 * devolver esses campos, o agendado de amanhã volta a aparecer como corrida de
 * agora — e nada quebra visivelmente. Este teste tranca a porta.
 *
 * `SCHED-01` já entregava os campos; aqui não se acrescenta nada ao servidor,
 * só se prova que o que a tela precisa continua chegando (e que o segredo do
 * `PICK-01` continua não chegando).
 */

const COURIER_ID = '11111111-1111-4111-8111-111111111111';

const courierUser: AuthenticatedUser = {
  id: 'user-courier',
  email: 'motoboy@aquilog.test',
  role: UserRole.COURIER,
  customerId: null,
};

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

function makeDelivery(overrides: Partial<Delivery>): Delivery {
  return Object.assign(new Delivery(), {
    id: 'd-1',
    code: 'AQL-1',
    status: DeliveryStatus.ACCEPTED,
    courierId: COURIER_ID,
    pickupAddress: 'Rua A, 10',
    deliveryAddress: 'Rua B, 20',
    priceCents: 1380,
    courierFeeCents: 1104,
    fulfillmentMode: 'IMMEDIATE',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    deliveryWindowStart: null,
    deliveryWindowEnd: null,
    productType: 'ELECTRONICS',
    packageSize: 'MEDIUM',
    weightKg: 2.5,
    productPhotoUrls: ['http://localhost:3001/api/v1/storage/files/a.jpg'],
    pickupCode: '4207',
    pickupCodeAttempts: 0,
    notes: null,
    ...overrides,
  });
}

function buildService(rows: Delivery[]) {
  const where: string[] = [];
  const queryBuilder = {
    orderBy: () => queryBuilder,
    andWhere: (clause: string) => {
      where.push(clause);
      return queryBuilder;
    },
    skip: () => queryBuilder,
    take: () => queryBuilder,
    getMany: () => Promise.resolve(rows),
    getManyAndCount: () => Promise.resolve([rows, rows.length]),
  };
  const deliveriesRepo = { createQueryBuilder: () => queryBuilder };
  const couriersRepo = {
    findOneBy: jest.fn(() =>
      Promise.resolve(
        Object.assign(new Courier(), {
          id: COURIER_ID,
          userId: courierUser.id,
          status: AccountStatus.ACTIVE,
          available: true,
        }),
      ),
    ),
  };
  const dataSource = {
    transaction: jest.fn((fn: (manager: unknown) => Promise<unknown>) =>
      fn({
        save: (entity: unknown) => Promise.resolve(entity),
        create: (_entityClass: unknown, data: unknown) => data,
      }),
    ),
  } as never;
  const service = new DeliveriesService(
    dataSource,
    deliveriesRepo as never,
    couriersRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      reserve: jest.fn().mockResolvedValue(null),
      settle: jest.fn().mockResolvedValue(null),
      release: jest.fn().mockResolvedValue(null),
    } as never,
    {} as never,
    { get: jest.fn(() => undefined) } as never,
    {} as never,
    {} as never,
  );
  return { service, where };
}

describe('COUR-01 — contrato da listagem do prestador', () => {
  it('devolve modo e janelas do agendado, que separam Agenda de Em andamento', async () => {
    const start = inMinutes(300);
    const end = inMinutes(360);
    const { service } = buildService([
      makeDelivery({
        id: 'd-agendada',
        code: 'AQL-AGEND',
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: start,
        pickupWindowEnd: end,
        deliveryWindowStart: end,
        deliveryWindowEnd: inMinutes(420),
      }),
    ]);

    const rows = (await service.findAll(courierUser, {})) as Record<
      string,
      unknown
    >[];

    expect(rows).toHaveLength(1);
    expect(rows[0].fulfillmentMode).toBe('SCHEDULED');
    expect(rows[0].pickupWindowStart).toEqual(start);
    expect(rows[0].pickupWindowEnd).toEqual(end);
    expect(rows[0].deliveryWindowStart).toEqual(end);
    // O card da agenda mostra código, status, endereços e repasse.
    expect(rows[0].code).toBe('AQL-AGEND');
    expect(rows[0].status).toBe(DeliveryStatus.ACCEPTED);
    expect(rows[0].pickupAddress).toBe('Rua A, 10');
    expect(rows[0].deliveryAddress).toBe('Rua B, 20');
    expect(rows[0].courierFeeCents).toBe(1104);
    // Encomenda (foto/peso) para o card.
    expect(rows[0].weightKg).toBe(2.5);
    expect(rows[0].productPhotoUrls).toEqual([
      'http://localhost:3001/api/v1/storage/files/a.jpg',
    ]);
  });

  it('pedido imediato chega sem janela, e é isso que o põe em Em andamento', async () => {
    const { service } = buildService([makeDelivery({})]);

    const rows = (await service.findAll(courierUser, {})) as Record<
      string,
      unknown
    >[];

    expect(rows[0].fulfillmentMode).toBe('IMMEDIATE');
    expect(rows[0].pickupWindowStart).toBeNull();
  });

  it('a lista continua sendo só as corridas daquele prestador', async () => {
    const { service, where } = buildService([makeDelivery({})]);

    await service.findAll(courierUser, {});

    expect(where).toContain('delivery.courierId = :courierId');
  });

  it('PICK-01 continua valendo: a lista do prestador não traz o código', async () => {
    const { service } = buildService([makeDelivery({})]);

    const rows = (await service.findAll(courierUser, {})) as Record<
      string,
      unknown
    >[];

    expect(rows[0].pickupCode).toBeUndefined();
    expect(rows[0].pickupCodeRequired).toBe(true);
  });
});
