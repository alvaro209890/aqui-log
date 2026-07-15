import { BadRequestException } from '@nestjs/common';
import { DeliveryStatus } from '../database/enums';
import { assertDeliveryTransition, distanceInKm } from './delivery-rules';

describe('delivery rules', () => {
  it('accepts the expected operational sequence', () => {
    expect(() =>
      assertDeliveryTransition(
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.IN_TRANSIT,
      ),
    ).not.toThrow();
  });

  it('blocks status jumps', () => {
    expect(() =>
      assertDeliveryTransition(
        DeliveryStatus.REQUESTED,
        DeliveryStatus.DELIVERED,
      ),
    ).toThrow(BadRequestException);
  });

  it('calculates a plausible distance', () => {
    const distance = distanceInKm(-19.9245, -43.9352, -19.9386, -43.9346);
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
  });
});
