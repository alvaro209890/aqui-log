import { BadRequestException } from '@nestjs/common';
import { DeliveryStatus } from '../database/enums';

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.REQUESTED]: [DeliveryStatus.OFFERED, DeliveryStatus.CANCELED],
  [DeliveryStatus.OFFERED]: [
    DeliveryStatus.REQUESTED,
    DeliveryStatus.ACCEPTED,
    DeliveryStatus.CANCELED,
  ],
  [DeliveryStatus.ACCEPTED]: [
    DeliveryStatus.AT_PICKUP,
    DeliveryStatus.CANCELED,
  ],
  [DeliveryStatus.AT_PICKUP]: [
    DeliveryStatus.PICKED_UP,
    DeliveryStatus.CANCELED,
  ],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.CANCELED]: [],
};

export function assertDeliveryTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new BadRequestException(`Transicao invalida: ${from} -> ${to}`);
  }
}

export function distanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lon2 - lon1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
