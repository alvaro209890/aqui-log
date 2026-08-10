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
        customerId?: string | null;
      }>(token);
      this.authenticatedUsers.set(client.id, {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        customerId: payload.customerId ?? null,
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

  /**
   * `DISP-02` — emissões no canal `delivery:{id}`, o mesmo que o app já usa
   * para tracking. O app cliente hoje acompanha por polling (`GET /deliveries
   * /:id`), então o aviso real chega pelo próprio pedido e pelo histórico; o
   * WebSocket é o canal que um app com socket (ou o painel) consumirá sem
   * mudança de contrato.
   */

  /** Plano §6.1.4 — primeiro atraso significativo. */
  emitFirstWarning(deliveryId: string, warningAt: Date) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:warning', {
      deliveryId,
      warningAt: warningAt.toISOString(),
    });
  }

  /** Plano §6.1.5 — busca esgotada; o cliente precisa agir. */
  emitDispatchEnded(
    deliveryId: string,
    reason: string,
    endedAt: Date,
    rounds: number,
  ) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:dispatch-ended', {
      deliveryId,
      reason,
      endedAt: endedAt.toISOString(),
      rounds,
    });
  }

  /** §3.3 / `DEC-03` — aumento de valor consentido e aplicado. */
  emitPriceBoosted(
    deliveryId: string,
    previousPriceCents: number,
    newPriceCents: number,
  ) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:price-boosted', {
      deliveryId,
      previousPriceCents,
      newPriceCents,
    });
  }

  /** Pedido editado pelo cliente (endereço, destinatário, janela…). */
  emitDeliveryUpdated(deliveryId: string) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:updated', {
      deliveryId,
    });
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
    if (user.role !== UserRole.COURIER) return false;
    const courier = await this.couriers.findOneBy({ userId: user.id });
    return courier?.id === delivery.courierId;
  }
}
