import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDeliveryDto } from './dto/delivery.dto';

const basePayload = {
  pickupAddress: 'Rua A, 10',
  pickupLatitude: -15.601,
  pickupLongitude: -56.097,
  deliveryAddress: 'Rua B, 20',
  deliveryLatitude: -15.61,
  deliveryLongitude: -56.11,
  recipientName: 'Maria',
  recipientPhone: '+5565999999999',
};

describe('CreateDeliveryDto package fields', () => {
  it('accepts the additive structured package contract', async () => {
    const dto = plainToInstance(CreateDeliveryDto, {
      ...basePayload,
      productType: 'ELECTRONICS',
      packageSize: 'MEDIUM',
      weightKg: 2.75,
      deliveryScope: 'SAME_CITY',
      productPhotoUrls: ['http://localhost:3001/api/v1/storage/files/a.jpg'],
      notes: 'Manusear com cuidado',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('keeps the legacy/B2B payload valid without package fields', async () => {
    const dto = plainToInstance(CreateDeliveryDto, basePayload);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects invalid codes, weight and excessive photos', async () => {
    const dto = plainToInstance(CreateDeliveryDto, {
      ...basePayload,
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

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
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
