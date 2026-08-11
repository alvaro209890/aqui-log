import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryStatus, UserRole } from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import { PICKUP_CODE_MAX_ATTEMPTS } from './pickup-code';

/**
 * PICK-01 — o caminho de coleta ponta a ponta, com repositórios de mentira.
 * O foco é a regra: quem vê o código, o que trava a transição e o que o erro
 * repetido provoca.
 */

const COURIER_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

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

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  email: 'admin@aquilog.test',
  role: UserRole.ADMIN,
  customerId: null,
};

const supportUser: AuthenticatedUser = {
  id: 'user-support',
  email: 'suporte@aquilog.test',
  role: UserRole.SUPPORT,
  customerId: null,
};

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return Object.assign(new Delivery(), {
    id: 'delivery-1',
    code: 'AQL-TESTE1',
    customerId: CUSTOMER_ID,
    createdById: customerUser.id,
    courierId: COURIER_ID,
    pickupAddress: 'Rua A, 10',
    deliveryAddress: 'Rua B, 20',
    status: DeliveryStatus.AT_PICKUP,
    productPhotoUrls: [
      'http://localhost:3001/api/v1/storage/files/product.jpg',
    ],
    pickupCode: '4207',
    pickupCodeAttempts: 0,
    pickupCodeBlockedUntil: null,
    pickupCodeVerifiedAt: null,
    pickupCodeOverrideById: null,
    pickupCodeOverrideReason: null,
    collectionProofUrl: null,
    deliveryProofUrl: null,
    ...overrides,
  });
}

function buildService(delivery: Delivery) {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const events = {
    save: jest.fn((v) => Promise.resolve(v)),
    create: (v: unknown) => v,
  };
  const deliveries = {
    findOneBy: jest.fn().mockResolvedValue(delivery),
    save: jest.fn((v) => Promise.resolve(v)),
  };
  const couriers = {
    findOneBy: jest
      .fn()
      .mockResolvedValue({ id: COURIER_ID, userId: courierUser.id }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    assertAllowedProofUrl: jest.fn(),
    assertAllowedProductPhotoUrl: jest.fn(),
  };
  const finance = {
    reserve: jest.fn().mockResolvedValue(null),
    settle: jest.fn().mockResolvedValue(null),
    release: jest.fn().mockResolvedValue(null),
  };
  const settings = {
    get: jest.fn().mockResolvedValue({
      dispatchFirstWarningMinutes: 5,
      dispatchPriceBoostPercent: 20,
    }),
  };

  const dataSource = {
    transaction: jest.fn((fn: (manager: unknown) => Promise<unknown>) =>
      fn({
        save: (entity: unknown) => {
          const repoSave = (
            deliveries as { save?: (entity: unknown) => Promise<unknown> }
          ).save;
          return repoSave ? repoSave(entity) : Promise.resolve(entity);
        },
        create: (_entityClass: unknown, data: unknown) => data,
      }),
    ),
  } as never;
  const service = new DeliveriesService(
    dataSource,
    deliveries as never,
    couriers as never,
    {} as never,
    events as never,
    {} as never,
    notifications as never,
    audit as never,
    finance as never,
    {} as never,
    {} as never,
    { get: jest.fn(() => undefined) } as never,
    storage as never,
    settings as never,
  );
  return { service, audit, notifications, deliveries, storage };
}

const PROOF_URL = 'http://localhost:3001/api/v1/storage/files/proof-coleta.jpg';

function auditActions(audit: { record: jest.Mock }) {
  const calls = audit.record.mock.calls as [{ action: string }][];
  return calls.map((call) => call[0].action);
}

describe('PICK-01 — coleta com codigo de recolhimento', () => {
  it('avanca para PICKED_UP com codigo certo e foto do prestador', async () => {
    const delivery = makeDelivery();
    const { service, audit } = buildService(delivery);

    const result = await service.updateStatus(
      delivery.id,
      {
        status: DeliveryStatus.PICKED_UP,
        proofUrl: PROOF_URL,
        pickupCode: '4207',
      },
      courierUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.PICKED_UP);
    expect(delivery.collectionProofUrl).toBe(PROOF_URL);
    expect(delivery.pickupCodeVerifiedAt).toBeInstanceOf(Date);
    expect(auditActions(audit)).toContain('DELIVERY_PICKUP_CODE_VERIFIED');
    // O prestador segue sem receber o número, mesmo depois de acertar.
    expect(result).not.toHaveProperty('pickupCode');
  });

  it('recusa a coleta sem codigo, com o pedido intacto', async () => {
    const delivery = makeDelivery();
    const { service } = buildService(delivery);

    await expect(
      service.updateStatus(
        delivery.id,
        { status: DeliveryStatus.PICKED_UP, proofUrl: PROOF_URL },
        courierUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('recusa a coleta com codigo errado e conta a tentativa', async () => {
    const delivery = makeDelivery();
    const { service, audit } = buildService(delivery);

    await expect(
      service.updateStatus(
        delivery.id,
        {
          status: DeliveryStatus.PICKED_UP,
          proofUrl: PROOF_URL,
          pickupCode: '0000',
        },
        courierUser,
      ),
    ).rejects.toThrow(/Restam 4 tentativas/);
    expect(delivery.pickupCodeAttempts).toBe(1);
    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
    expect(auditActions(audit)).toContain('DELIVERY_PICKUP_CODE_FAILED');
  });

  it('bloqueia e alerta depois de 5 erros; a sexta tentativa cai no bloqueio', async () => {
    const delivery = makeDelivery();
    const { service, audit, notifications } = buildService(delivery);

    for (let i = 1; i <= PICKUP_CODE_MAX_ATTEMPTS; i += 1) {
      await expect(
        service.updateStatus(
          delivery.id,
          {
            status: DeliveryStatus.PICKED_UP,
            proofUrl: PROOF_URL,
            pickupCode: '0000',
          },
          courierUser,
        ),
      ).rejects.toBeDefined();
    }

    expect(delivery.pickupCodeBlockedUntil).toBeInstanceOf(Date);
    expect(auditActions(audit)).toContain('DELIVERY_PICKUP_CODE_BLOCKED');
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Código de recolhimento bloqueado' }),
    );

    // Bloqueado, nem o código certo passa enquanto durar.
    const blocked = await service
      .updateStatus(
        delivery.id,
        {
          status: DeliveryStatus.PICKED_UP,
          proofUrl: PROOF_URL,
          pickupCode: '4207',
        },
        courierUser,
      )
      .catch((error: unknown) => error);
    expect(blocked).toBeInstanceOf(HttpException);
    expect((blocked as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('recusa reapresentar a foto do cliente como prova de coleta (DEC-24)', async () => {
    const delivery = makeDelivery();
    const { service } = buildService(delivery);

    await expect(
      service.updateStatus(
        delivery.id,
        {
          status: DeliveryStatus.PICKED_UP,
          proofUrl: delivery.productPhotoUrls[0],
          pickupCode: '4207',
        },
        courierUser,
      ),
    ).rejects.toThrow(/foto de coleta precisa ser do prestador/);
    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });

  it('pedido legado sem codigo continua avancando so com a foto', async () => {
    const delivery = makeDelivery({ pickupCode: null, productPhotoUrls: [] });
    const { service, audit } = buildService(delivery);

    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.PICKED_UP, proofUrl: PROOF_URL },
      courierUser,
    );

    expect(delivery.status).toBe(DeliveryStatus.PICKED_UP);
    expect(auditActions(audit)).not.toContain('DELIVERY_PICKUP_CODE_VERIFIED');
  });

  it('a foto continua obrigatoria mesmo com o codigo certo', async () => {
    const delivery = makeDelivery();
    const { service } = buildService(delivery);

    await expect(
      service.updateStatus(
        delivery.id,
        { status: DeliveryStatus.PICKED_UP, pickupCode: '4207' },
        courierUser,
      ),
    ).rejects.toThrow(/Comprovante obrigatorio/);
    expect(delivery.status).toBe(DeliveryStatus.AT_PICKUP);
  });
});

describe('PICK-01 — quem enxerga o codigo', () => {
  it('cliente ve o codigo; prestador ve so a exigencia e as tentativas', async () => {
    const delivery = makeDelivery({ pickupCodeAttempts: 2 });
    const { service } = buildService(delivery);

    const forCustomer = (await service.findOne(
      delivery.id,
      customerUser,
    )) as Record<string, unknown>;
    const forCourier = (await service.findOne(
      delivery.id,
      courierUser,
    )) as Record<string, unknown>;

    expect(forCustomer.pickupCode).toBe('4207');
    expect(forCourier).not.toHaveProperty('pickupCode');
    expect(forCourier.pickupCodeRequired).toBe(true);
    expect(forCourier.pickupCodeAttemptsLeft).toBe(
      PICKUP_CODE_MAX_ATTEMPTS - 2,
    );
  });

  it('admin ve codigo, tentativas e a liberacao registrada', async () => {
    const delivery = makeDelivery({
      pickupCodeOverrideById: adminUser.id,
      pickupCodeOverrideReason:
        'Cliente perdeu o codigo; confirmado por telefone',
    });
    const { service } = buildService(delivery);

    const forAdmin = (await service.findOne(delivery.id, adminUser)) as Record<
      string,
      unknown
    >;

    expect(forAdmin.pickupCode).toBe('4207');
    expect(forAdmin.pickupCodeOverrideReason).toContain('perdeu o codigo');
  });

  it('pedido legado nao passa a exigir codigo', async () => {
    const delivery = makeDelivery({ pickupCode: null });
    const { service } = buildService(delivery);

    const view = (await service.findOne(delivery.id, courierUser)) as Record<
      string,
      unknown
    >;

    expect(view.pickupCodeRequired).toBe(false);
    expect(view.pickupCodeAttemptsLeft).toBeNull();
  });
});

describe('PICK-01 — fallback de codigo perdido (DEC-24)', () => {
  it('suporte libera com motivo, auditoria e aviso ao cliente', async () => {
    const delivery = makeDelivery({ pickupCodeAttempts: 3 });
    const { service, audit, notifications } = buildService(delivery);

    await service.overridePickupCode(
      delivery.id,
      { reason: 'Etiqueta ilegivel; cliente confirmou por telefone' },
      supportUser,
    );

    expect(delivery.pickupCodeVerifiedAt).toBeInstanceOf(Date);
    expect(delivery.pickupCodeAttempts).toBe(0);
    expect(delivery.pickupCodeOverrideById).toBe(supportUser.id);
    expect(auditActions(audit)).toContain('DELIVERY_PICKUP_CODE_OVERRIDE');
    expect(notifications.create).toHaveBeenCalled();

    // Depois da liberação, a coleta anda sem código — mas ainda com foto.
    await service.updateStatus(
      delivery.id,
      { status: DeliveryStatus.PICKED_UP, proofUrl: PROOF_URL },
      courierUser,
    );
    expect(delivery.status).toBe(DeliveryStatus.PICKED_UP);
  });

  it('prestador nao pode se autoliberar', async () => {
    const delivery = makeDelivery();
    const { service } = buildService(delivery);

    await expect(
      service.overridePickupCode(
        delivery.id,
        { reason: 'Nao consegui ler o codigo do cliente' },
        courierUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(delivery.pickupCodeVerifiedAt).toBeNull();
  });

  it('so libera pedido que esta mesmo em AT_PICKUP', async () => {
    const delivery = makeDelivery({ status: DeliveryStatus.ACCEPTED });
    const { service } = buildService(delivery);

    await expect(
      service.overridePickupCode(
        delivery.id,
        { reason: 'Tentativa antecipada de liberacao' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('nao inventa liberacao para pedido legado sem codigo', async () => {
    const delivery = makeDelivery({ pickupCode: null });
    const { service } = buildService(delivery);

    await expect(
      service.overridePickupCode(
        delivery.id,
        { reason: 'Pedido antigo, sem codigo nenhum' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
