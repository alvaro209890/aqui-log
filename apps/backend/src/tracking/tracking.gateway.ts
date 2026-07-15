import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { IsLatitude, IsLongitude, IsUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Courier } from '../database/entities/courier.entity';

class LocationPayload {
  @IsUUID()
  courierId!: string;

  @IsUUID()
  deliveryId!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

@WebSocketGateway({ namespace: 'tracking', cors: { origin: '*' } })
export class TrackingGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
  ) {}

  @SubscribeMessage('courier:location')
  async updateLocation(
    @MessageBody() payload: LocationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    await this.couriers.update(payload.courierId, {
      lastLatitude: payload.latitude,
      lastLongitude: payload.longitude,
    });
    void client.join(`delivery:${payload.deliveryId}`);
    void this.server
      .to(`delivery:${payload.deliveryId}`)
      .emit('delivery:location', payload);
    return { received: true };
  }
}
