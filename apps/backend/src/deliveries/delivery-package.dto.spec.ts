import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateDeliveryDto,
  PickupCodeOverrideDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

const addressPayload = {
  pickupAddress: 'Rua A, 10',
  pickupLatitude: -15.601,
  pickupLongitude: -56.097,
  deliveryAddress: 'Rua B, 20',
  deliveryLatitude: -15.61,
  deliveryLongitude: -56.11,
  recipientName: 'Maria',
  recipientPhone: '+5565999999999',
};

const packagePayload = {
  productType: 'ELECTRONICS',
  packageSize: 'MEDIUM',
  weightKg: 2.75,
  productPhotoUrls: ['http://localhost:3001/api/v1/storage/files/a.jpg'],
};

/** Payload completo de um pedido novo, conforme `DEC-01`. */
const basePayload = { ...addressPayload, ...packagePayload };

async function failedProperties(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateDeliveryDto, payload);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('CreateDeliveryDto package fields', () => {
  it('accepts the complete structured package contract', async () => {
    const dto = plainToInstance(CreateDeliveryDto, {
      ...basePayload,
      deliveryScope: 'SAME_CITY',
      notes: 'Manusear com cuidado',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects invalid codes, weight and excessive photos', async () => {
    const properties = await failedProperties({
      ...addressPayload,
      productType: 'Eletrônico',
      packageSize: 'HUGE',
      weightKg: 0,
      deliveryScope: 'INTERSTATE',
      productPhotoUrls: [
        'http://localhost/a.jpg',
        'http://localhost/b.jpg',
        'http://localhost/c.jpg',
        'http://localhost/d.jpg',
      ],
    });

    expect(properties).toEqual(
      expect.arrayContaining([
        'productType',
        'packageSize',
        'weightKg',
        'deliveryScope',
        'productPhotoUrls',
      ]),
    );
  });
});

// B2C-05 / DEC-01: a obrigatoriedade vale para a CRIAÇÃO. Leitura de pedido
// legado (sem esses campos) não passa por este DTO e segue funcionando.
describe('CreateDeliveryDto obrigatoriedade da criação (B2C-05)', () => {
  it('rejeita o payload legado, sem nenhum campo de encomenda', async () => {
    const properties = await failedProperties(addressPayload);

    expect(properties).toEqual(
      expect.arrayContaining([
        'productType',
        'packageSize',
        'weightKg',
        'productPhotoUrls',
      ]),
    );
  });

  it.each([
    ['productType', 'Informe o tipo da encomenda'],
    ['packageSize', 'Informe o tamanho da encomenda (SMALL, MEDIUM ou LARGE)'],
    ['weightKg', 'Informe o peso da encomenda em kg'],
    ['productPhotoUrls', 'Envie ao menos uma foto da encomenda'],
  ])('rejeita pedido sem %s com mensagem útil', async (field, message) => {
    const payload = { ...basePayload };
    delete (payload as Record<string, unknown>)[field];

    const dto = plainToInstance(CreateDeliveryDto, payload);
    const errors = await validate(dto);
    const target = errors.find((error) => error.property === field);

    expect(target).toBeDefined();
    expect(Object.values(target!.constraints ?? {})).toContain(message);
  });

  it('rejeita lista de fotos vazia', async () => {
    const properties = await failedProperties({
      ...basePayload,
      productPhotoUrls: [],
    });

    expect(properties).toContain('productPhotoUrls');
  });

  it.each(['pickupAddress', 'deliveryAddress'])(
    'rejeita %s ausente ou em branco',
    async (field) => {
      const missing = { ...basePayload };
      delete (missing as Record<string, unknown>)[field];
      await expect(failedProperties(missing)).resolves.toContain(field);

      await expect(
        failedProperties({ ...basePayload, [field]: '   ' }),
      ).resolves.toContain(field);
    },
  );

  it('rejeita coordenada ausente', async () => {
    const missing = { ...basePayload };
    delete (missing as Record<string, unknown>).pickupLatitude;

    await expect(failedProperties(missing)).resolves.toContain(
      'pickupLatitude',
    );
  });
});

/** PICK-01 / DEC-24 — o fallback de código exige motivo escrito, não um "ok". */
describe('PickupCodeOverrideDto', () => {
  it('aceita um motivo descritivo', async () => {
    const dto = plainToInstance(PickupCodeOverrideDto, {
      reason: 'Etiqueta rasgada; cliente confirmou por telefone',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('recusa motivo vazio, curto ou so de espacos', async () => {
    for (const reason of ['', '   ', 'perdeu']) {
      const dto = plainToInstance(PickupCodeOverrideDto, { reason });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('reason');
    }
  });
});

/** PICK-01 — o código chega junto da mudança de status. */
describe('UpdateDeliveryStatusDto pickupCode', () => {
  it('aceita a coleta com codigo e comprovante', async () => {
    const dto = plainToInstance(UpdateDeliveryStatusDto, {
      status: 'PICKED_UP',
      proofUrl: 'http://localhost:3001/api/v1/storage/files/proof.jpg',
      pickupCode: '4207',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('segue opcional, para nao quebrar as demais transicoes', async () => {
    const dto = plainToInstance(UpdateDeliveryStatusDto, {
      status: 'IN_TRANSIT',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
