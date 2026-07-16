import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { Courier } from '../database/entities/courier.entity';
import { DeliveryEvent } from '../database/entities/delivery-event.entity';
import { DeliveryOffer } from '../database/entities/delivery-offer.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { Rating } from '../database/entities/rating.entity';
import {
  AccountStatus,
  DeliveryStatus,
  NotificationType,
  OfferStatus,
  UserRole,
} from '../database/enums';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { RedisService } from '../redis/redis.module';
import {
  OFFER_ACCEPT_LOCK_TTL_SECONDS,
  offerAcceptLockKey,
} from './delivery-locks';
import { assertDeliveryTransition, distanceInKm } from './delivery-rules';
import {
  AssignCourierDto,
  CreateDeliveryDto,
  RateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    @InjectRepository(DeliveryOffer)
    private readonly offers: Repository<DeliveryOffer>,
    @InjectRepository(DeliveryEvent)
    private readonly events: Repository<DeliveryEvent>,
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService,
    private readonly pricing: PricingService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateDeliveryDto, user: AuthenticatedUser) {
    if (!user.companyId)
      throw new ForbiddenException('Usuario sem empresa vinculada');
    const quote = this.pricing.quote({
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
    });
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        ...dto,
        code: this.createCode(),
        companyId: user.companyId,
        createdById: user.id,
        courierId: null,
        notes: dto.notes ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        // Server-side pricing always wins (client price fields ignored)
        priceCents: quote.priceCents,
        courierFeeCents: quote.courierFeeCents,
        collectionProofUrl: null,
        deliveryProofUrl: null,
        canceledAt: null,
      }),
    );
    await this.recordEvent(
      delivery,
      user.id,
      `Entrega solicitada (dist ${quote.distanceKm}km)`,
    );
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_CREATED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        companyId: delivery.companyId,
        pricing: quote,
      },
    });
    return delivery;
  }

  async findAll(
    user: AuthenticatedUser,
    filters: {
      status?: string;
      company?: string;
      courier?: string;
      date?: string;
    } = {},
  ) {
    const qb = this.deliveries
      .createQueryBuilder('delivery')
      .orderBy('delivery.createdAt', 'DESC');

    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        user.role,
      )
    ) {
      // full access
    } else if (user.companyId) {
      qb.andWhere('delivery.companyId = :companyId', {
        companyId: user.companyId,
      });
    } else {
      const courier = await this.getCourierByUser(user.id);
      qb.andWhere('delivery.courierId = :courierId', {
        courierId: courier.id,
      });
    }

    if (filters.status) {
      qb.andWhere('delivery.status = :status', { status: filters.status });
    }
    if (
      filters.company &&
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        user.role,
      )
    ) {
      qb.andWhere('delivery.companyId = :filterCompany', {
        filterCompany: filters.company,
      });
    }
    if (filters.courier) {
      qb.andWhere('delivery.courierId = :filterCourier', {
        filterCourier: filters.courier,
      });
    }
    if (filters.date) {
      const day = filters.date.slice(0, 10);
      qb.andWhere('delivery.created_at::date = :day::date', { day });
    }

    return qb.getMany();
  }

  async listRatings() {
    return this.ratings.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async history(id: string, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    return this.events.find({
      where: { deliveryId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async findOffers(userId: string) {
    const courier = await this.getCourierByUser(userId);
    const offers = await this.offers.find({
      where: { courierId: courier.id, status: OfferStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    const deliveries = offers.length
      ? await this.deliveries.findBy({
          id: In(offers.map((offer) => offer.deliveryId)),
        })
      : [];
    const byId = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
    return offers.map((offer) => ({
      ...offer,
      delivery: byId.get(offer.deliveryId),
    }));
  }

  async assign(id: string, dto: AssignCourierDto, actorId: string) {
    const delivery = await this.getById(id);
    const courier = await this.couriers.findOneBy({ id: dto.courierId });
    if (
      !courier ||
      courier.status !== AccountStatus.ACTIVE ||
      !courier.available
    ) {
      throw new BadRequestException('Entregador indisponivel ou nao aprovado');
    }
    return this.createOffer(delivery, courier, actorId, 'Despacho manual');
  }

  async dispatch(id: string, actorId: string) {
    const delivery = await this.getById(id);
    if (delivery.status !== DeliveryStatus.REQUESTED) {
      throw new ConflictException('A entrega nao esta aguardando despacho');
    }
    const rejected = await this.offers.findBy({
      deliveryId: id,
      status: OfferStatus.REJECTED,
    });
    const rejectedIds = new Set(rejected.map((offer) => offer.courierId));
    const candidates = (
      await this.couriers.findBy({
        status: AccountStatus.ACTIVE,
        available: true,
      })
    ).filter(
      (courier) =>
        courier.lastLatitude !== null &&
        courier.lastLongitude !== null &&
        !rejectedIds.has(courier.id),
    );
    if (!candidates.length)
      throw new NotFoundException(
        'Nenhum entregador disponivel com localizacao',
      );
    const courier = candidates.sort(
      (a, b) =>
        distanceInKm(
          Number(a.lastLatitude),
          Number(a.lastLongitude),
          Number(delivery.pickupLatitude),
          Number(delivery.pickupLongitude),
        ) -
        distanceInKm(
          Number(b.lastLatitude),
          Number(b.lastLongitude),
          Number(delivery.pickupLatitude),
          Number(delivery.pickupLongitude),
        ),
    )[0];
    return this.createOffer(
      delivery,
      courier,
      actorId,
      'Despacho automatico por proximidade',
    );
  }

  async acceptOffer(offerId: string, userId: string) {
    const lockKey = offerAcceptLockKey(offerId);
    const locked = await this.redis.acquireLock(
      lockKey,
      OFFER_ACCEPT_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      throw new ConflictException('Oferta em processamento; tente novamente');
    }
    try {
      const courier = await this.getCourierByUser(userId);
      const offer = await this.getPendingOffer(offerId, courier.id);
      const delivery = await this.getById(offer.deliveryId);
      if (delivery.status !== DeliveryStatus.OFFERED) {
        throw new ConflictException('Entrega nao esta mais em oferta');
      }
      assertDeliveryTransition(delivery.status, DeliveryStatus.ACCEPTED);
      offer.status = OfferStatus.ACCEPTED;
      offer.respondedAt = new Date();
      delivery.status = DeliveryStatus.ACCEPTED;
      delivery.acceptedAt = new Date();
      delivery.courierId = courier.id;
      courier.available = false;
      // Expire sibling pending offers for this delivery
      await this.offers
        .createQueryBuilder()
        .update()
        .set({ status: OfferStatus.CANCELED, respondedAt: new Date() })
        .where('delivery_id = :deliveryId', { deliveryId: delivery.id })
        .andWhere('id != :offerId', { offerId })
        .andWhere('status = :pending', { pending: OfferStatus.PENDING })
        .execute();
      await Promise.all([
        this.offers.save(offer),
        this.deliveries.save(delivery),
        this.couriers.save(courier),
      ]);
      await this.recordEvent(delivery, userId, 'Corrida aceita');
      await this.notifyCreator(
        delivery,
        'Corrida aceita',
        `O entregador aceitou a entrega ${delivery.code}`,
      );
      await this.audit.record({
        actorId: userId,
        action: 'DELIVERY_OFFER_ACCEPTED',
        resourceType: 'delivery',
        resourceId: delivery.id,
        metadata: { offerId, courierId: courier.id },
      });
      return delivery;
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  /** Expire PENDING offers past expiresAt; re-open delivery and try redispatch. */
  async expireStaleOffers(): Promise<number> {
    const stale = await this.offers.find({
      where: {
        status: OfferStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
      take: 50,
    });
    let count = 0;
    for (const offer of stale) {
      offer.status = OfferStatus.EXPIRED;
      offer.respondedAt = new Date();
      await this.offers.save(offer);
      count += 1;
      const delivery = await this.deliveries.findOneBy({
        id: offer.deliveryId,
      });
      if (
        delivery &&
        delivery.status === DeliveryStatus.OFFERED &&
        delivery.courierId === offer.courierId
      ) {
        delivery.status = DeliveryStatus.REQUESTED;
        delivery.courierId = null;
        await this.deliveries.save(delivery);
        await this.recordEvent(
          delivery,
          null,
          'Oferta expirada; reabrindo despacho',
        );
        try {
          await this.dispatch(delivery.id, delivery.createdById);
        } catch {
          // no courier available — stays REQUESTED
        }
      }
    }
    return count;
  }

  /** Auto-dispatch REQUESTED deliveries whose scheduledAt has arrived. */
  async dispatchDueScheduled(): Promise<number> {
    const due = await this.deliveries.find({
      where: {
        status: DeliveryStatus.REQUESTED,
        scheduledAt: LessThanOrEqual(new Date()),
      },
      take: 20,
      order: { scheduledAt: 'ASC' },
    });
    // Also only those with non-null scheduledAt
    const withSchedule = due.filter((d) => d.scheduledAt !== null);
    let count = 0;
    for (const delivery of withSchedule) {
      try {
        await this.dispatch(delivery.id, delivery.createdById);
        count += 1;
      } catch {
        // skip if no couriers
      }
    }
    return count;
  }

  async rejectOffer(offerId: string, userId: string) {
    const courier = await this.getCourierByUser(userId);
    const offer = await this.getPendingOffer(offerId, courier.id);
    const delivery = await this.getById(offer.deliveryId);
    offer.status = OfferStatus.REJECTED;
    offer.respondedAt = new Date();
    delivery.status = DeliveryStatus.REQUESTED;
    delivery.courierId = null;
    await Promise.all([
      this.offers.save(offer),
      this.deliveries.save(delivery),
    ]);
    await this.recordEvent(
      delivery,
      userId,
      'Oferta recusada; aguardando novo despacho',
    );
    return delivery;
  }

  async updateStatus(
    id: string,
    dto: UpdateDeliveryStatusDto,
    user: AuthenticatedUser,
  ) {
    const delivery = await this.getById(id);
    await this.ensureCanTransition(delivery, dto.status, user);
    assertDeliveryTransition(delivery.status, dto.status);
    if (
      [DeliveryStatus.PICKED_UP, DeliveryStatus.DELIVERED].includes(
        dto.status,
      ) &&
      !dto.proofUrl
    ) {
      throw new BadRequestException('Comprovante obrigatorio para esta etapa');
    }
    delivery.status = dto.status;
    if (dto.status === DeliveryStatus.PICKED_UP)
      delivery.collectionProofUrl = dto.proofUrl ?? null;
    if (dto.status === DeliveryStatus.DELIVERED) {
      delivery.deliveryProofUrl = dto.proofUrl ?? null;
      delivery.deliveredAt = new Date();
    }
    if (dto.status === DeliveryStatus.CANCELED)
      delivery.canceledAt = new Date();
    await this.deliveries.save(delivery);
    await this.recordEvent(delivery, user.id, dto.note ?? null, dto.proofUrl);
    if (
      [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELED].includes(
        dto.status,
      ) &&
      delivery.courierId
    ) {
      await this.couriers.update(delivery.courierId, { available: true });
    }
    if (dto.status === DeliveryStatus.DELIVERED)
      await this.finance.creditDelivery(delivery);
    await this.notifyCreator(
      delivery,
      'Entrega atualizada',
      `${delivery.code} agora esta em ${dto.status}`,
    );
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_STATUS_CHANGED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: { status: dto.status },
    });
    return delivery;
  }

  async rate(id: string, dto: RateDeliveryDto, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    if (!user.companyId || delivery.companyId !== user.companyId) {
      throw new ForbiddenException('Entrega de outra empresa');
    }
    if (delivery.status !== DeliveryStatus.DELIVERED || !delivery.courierId) {
      throw new BadRequestException(
        'Somente entregas concluidas podem ser avaliadas',
      );
    }
    if (await this.ratings.findOneBy({ deliveryId: id })) {
      throw new ConflictException('Entrega ja avaliada');
    }
    return this.ratings.save(
      this.ratings.create({
        deliveryId: id,
        companyId: user.companyId,
        courierId: delivery.courierId,
        score: dto.score,
        comment: dto.comment ?? null,
      }),
    );
  }

  private async createOffer(
    delivery: Delivery,
    courier: Courier,
    actorId: string,
    note: string,
  ) {
    assertDeliveryTransition(delivery.status, DeliveryStatus.OFFERED);
    const ttlSeconds = Number(this.config.get('OFFER_TTL_SECONDS') ?? 120);
    const offer = await this.offers.save(
      this.offers.create({
        deliveryId: delivery.id,
        courierId: courier.id,
        status: OfferStatus.PENDING,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        respondedAt: null,
      }),
    );
    delivery.courierId = courier.id;
    delivery.status = DeliveryStatus.OFFERED;
    await this.deliveries.save(delivery);
    await this.recordEvent(delivery, actorId, note);
    await this.notifications.create({
      userId: courier.userId,
      type: NotificationType.DELIVERY,
      title: 'Nova corrida disponivel',
      body: `${delivery.code}: ${delivery.pickupAddress} ate ${delivery.deliveryAddress}`,
      data: { deliveryId: delivery.id, offerId: offer.id },
    });
    return { delivery, offer };
  }

  private async getPendingOffer(id: string, courierId: string) {
    const offer = await this.offers.findOneBy({
      id,
      courierId,
      status: OfferStatus.PENDING,
    });
    if (!offer) throw new NotFoundException('Oferta nao encontrada');
    if (offer.expiresAt.getTime() < Date.now()) {
      offer.status = OfferStatus.EXPIRED;
      offer.respondedAt = new Date();
      await this.offers.save(offer);
      throw new ConflictException('Oferta expirada');
    }
    return offer;
  }

  private async ensureCanView(delivery: Delivery, user: AuthenticatedUser) {
    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        user.role,
      )
    )
      return;
    if (user.companyId === delivery.companyId) return;
    const courier = await this.getCourierByUser(user.id);
    if (courier.id !== delivery.courierId)
      throw new ForbiddenException('Acesso negado');
  }

  private async ensureCanTransition(
    delivery: Delivery,
    target: DeliveryStatus,
    user: AuthenticatedUser,
  ) {
    if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(user.role)) return;
    if ([UserRole.COMPANY_OWNER, UserRole.COMPANY_USER].includes(user.role)) {
      if (
        target !== DeliveryStatus.CANCELED ||
        user.companyId !== delivery.companyId
      ) {
        throw new ForbiddenException(
          'Empresa pode apenas cancelar suas entregas',
        );
      }
      return;
    }
    const courier = await this.getCourierByUser(user.id);
    if (delivery.courierId !== courier.id)
      throw new ForbiddenException('Entrega de outro entregador');
  }

  private async recordEvent(
    delivery: Delivery,
    actorId: string | null,
    note: string | null,
    proofUrl?: string,
  ) {
    return this.events.save(
      this.events.create({
        deliveryId: delivery.id,
        actorId,
        status: delivery.status,
        note,
        proofUrl: proofUrl ?? null,
      }),
    );
  }

  private notifyCreator(delivery: Delivery, title: string, body: string) {
    return this.notifications.create({
      userId: delivery.createdById,
      type: NotificationType.DELIVERY,
      title,
      body,
      data: { deliveryId: delivery.id, status: delivery.status },
    });
  }

  private async getCourierByUser(userId: string) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    return courier;
  }

  private async getById(id: string) {
    const delivery = await this.deliveries.findOneBy({ id });
    if (!delivery) throw new NotFoundException('Entrega nao encontrada');
    return delivery;
  }

  private createCode() {
    return `AQL-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }
}
