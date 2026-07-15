import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { IsLatitude, IsLongitude, IsUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { UserRole } from '../database/enums';

class LocationPayload {
  @IsUUID()
  deliveryId!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

class WatchPayload {
  @IsUUID()
  deliveryId!: string;
}

@WebSocketGateway({ namespace: 'tracking', cors: { origin: '*' } })
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly authenticatedUsers = new Map<string, AuthenticatedUser>();

  constructor(
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const handshakeToken: unknown = client.handshake.auth.token;
    const authorization = client.handshake.headers.authorization;
    const rawToken =
      (typeof handshakeToken === 'string' ? handshakeToken : undefined) ??
      (typeof authorization === 'string' ? authorization : undefined);
    try {
      if (!rawToken) throw new Error('missing token');
      const token = rawToken.replace(/^Bearer\s+/i, '');
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: UserRole;
        companyId: string | null;
      }>(token);
      this.authenticatedUsers.set(client.id, {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId,
      });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.authenticatedUsers.delete(client.id);
  }

  @SubscribeMessage('delivery:watch')
  async watchDelivery(
    @MessageBody() payload: WatchPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    const delivery = await this.deliveries.findOneBy({
      id: payload.deliveryId,
    });
    if (!delivery || !(await this.canAccess(delivery, user))) {
      throw new WsException('Acesso negado');
    }
    await client.join(`delivery:${payload.deliveryId}`);
    return { watching: payload.deliveryId };
  }

  @SubscribeMessage('courier:location')
  async updateLocation(
    @MessageBody() payload: LocationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    if (user.role !== UserRole.COURIER) throw new WsException('Acesso negado');
    const courier = await this.couriers.findOneBy({
      userId: user.id,
    });
    const delivery = await this.deliveries.findOneBy({
      id: payload.deliveryId,
    });
    if (!courier || !delivery || delivery.courierId !== courier.id) {
      throw new WsException('Entrega nao vinculada ao entregador');
    }
    courier.lastLatitude = payload.latitude;
    courier.lastLongitude = payload.longitude;
    await this.couriers.save(courier);
    this.server.to(`delivery:${payload.deliveryId}`).emit('delivery:location', {
      deliveryId: payload.deliveryId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      updatedAt: new Date().toISOString(),
    });
    return { received: true };
  }

  private getUser(client: Socket) {
    const user = this.authenticatedUsers.get(client.id);
    if (!user) throw new WsException('Nao autenticado');
    return user;
  }

  private async canAccess(delivery: Delivery, user: AuthenticatedUser) {
    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        user.role,
      )
    )
      return true;
    if (user.companyId === delivery.companyId) return true;
    if (user.role !== UserRole.COURIER) return false;
    const courier = await this.couriers.findOneBy({ userId: user.id });
    return courier?.id === delivery.courierId;
  }
}
