import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import { SettingsService } from '../settings/settings.module';
import { StorageService } from '../storage/storage.module';
import { parsePagination, toPageResult } from '../common/pagination';
import {
  OFFER_ACCEPT_LOCK_TTL_SECONDS,
  offerAcceptLockKey,
} from './delivery-locks';
import { assertDeliveryTransition, distanceInKm } from './delivery-rules';
import {
  PICKUP_CODE_MAX_ATTEMPTS,
  generatePickupCode,
  isPickupCodeBlocked,
  pickupCodeBlockSecondsLeft,
  pickupCodeMatches,
  registerPickupCodeFailure,
} from './pickup-code';
import {
  AssignCourierDto,
  CreateDeliveryDto,
  PACKAGE_SIZES,
  PickupCodeOverrideDto,
  PRODUCT_TYPES,
  RateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

const STAFF_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT];

/** UUID canônico (qualquer versão), case-insensitive. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOptionalCustomerId(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  const value = raw.trim();
  if (!UUID_RE.test(value)) {
    throw new BadRequestException('customerId invalido. Use um UUID.');
  }
  return value;
}

function parseOptionalWeightBound(
  raw: string | undefined,
  field: 'weightMin' | 'weightMax',
): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`${field} deve ser um numero >= 0 (kg)`);
  }
  return value;
}

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
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: CreateDeliveryDto, user: AuthenticatedUser) {
    const isCustomer = user.role === UserRole.CUSTOMER;
    if (!isCustomer)
      throw new ForbiddenException('Somente clientes podem criar pedidos');
    if (isCustomer && !user.customerId)
      throw new ForbiddenException('Cliente sem cadastro completo');
    // B2C-05 / DEC-01: o DTO já garante ao menos uma foto na criação; aqui só
    // resta provar que cada URL veio do storage desta instalação.
    const productPhotoUrls = dto.productPhotoUrls;
    for (const url of productPhotoUrls) {
      this.storage.assertAllowedProductPhotoUrl(url);
    }
    // B2C-02: o preço agora considera peso e tamanho da encomenda, que o
    // B2C-05 tornou obrigatórios. O modo default é IMMEDIATE; o agendado
    // (SCHED-01) ainda não é escolhido pelo cliente.
    const quote = await this.pricing.quoteAsync({
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      fulfillmentMode: 'IMMEDIATE',
      weightKg: dto.weightKg,
      packageSize: dto.packageSize,
    });
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        ...dto,
        code: this.createCode(),
        customerId: isCustomer ? user.customerId : null,
        createdById: user.id,
        courierId: null,
        notes: dto.notes ?? null,
        productType: dto.productType,
        packageSize: dto.packageSize,
        weightKg: dto.weightKg,
        deliveryScope: dto.deliveryScope ?? null,
        productPhotoUrls,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        // Server-side pricing always wins (client price fields ignored)
        priceCents: quote.priceCents,
        courierFeeCents: quote.courierFeeCents,
        // B2C-02A: congela regra e valores usados (DEC-19).
        pricingVersion: quote.pricingVersion,
        pricingBreakdown: quote.breakdown,
        fulfillmentMode: quote.breakdown.fulfillmentMode,
        collectionProofUrl: null,
        deliveryProofUrl: null,
        canceledAt: null,
      }),
    );
    await this.recordEvent(
      delivery,
      user.id,
      `Pedido solicitado (dist ${quote.distanceKm}km)`,
    );
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_CREATED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        customerId: delivery.customerId,
        package: {
          productType: delivery.productType,
          packageSize: delivery.packageSize,
          weightKg: delivery.weightKg,
          deliveryScope: delivery.deliveryScope,
          productPhotoCount: delivery.productPhotoUrls.length,
        },
        pricing: quote,
      },
    });
    // B2C: pedido do cliente é publicado direto para os motoboys próximos.
    // Se não houver motoboy disponível agora, fica REQUESTED e o job de
    // redespacho (expireStaleOffers) tenta de novo quando houver.
    try {
      await this.dispatch(delivery.id, user.id);
    } catch {
      // sem motoboy disponível no momento — segue REQUESTED
    }
    return this.present(delivery, user);
  }

  async findAll(
    user: AuthenticatedUser,
    filters: {
      status?: string;
      courier?: string;
      date?: string;
      productType?: string;
      packageSize?: string;
      weightMin?: string;
      weightMax?: string;
      customerId?: string;
      page?: string;
      limit?: string;
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
    } else if (user.role === UserRole.CUSTOMER) {
      qb.andWhere('delivery.customerId = :customerId', {
        customerId: user.customerId,
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
    if (filters.courier) {
      qb.andWhere('delivery.courierId = :filterCourier', {
        filterCourier: filters.courier,
      });
    }
    if (filters.date) {
      const day = filters.date.slice(0, 10);
      qb.andWhere('delivery.created_at::date = :day::date', { day });
    }
    if (filters.productType) {
      if (!(PRODUCT_TYPES as readonly string[]).includes(filters.productType)) {
        throw new BadRequestException(
          `productType invalido. Use: ${PRODUCT_TYPES.join(', ')}`,
        );
      }
      qb.andWhere('delivery.productType = :productType', {
        productType: filters.productType,
      });
    }
    if (filters.packageSize) {
      if (!(PACKAGE_SIZES as readonly string[]).includes(filters.packageSize)) {
        throw new BadRequestException(
          `packageSize invalido. Use: ${PACKAGE_SIZES.join(', ')}`,
        );
      }
      qb.andWhere('delivery.packageSize = :packageSize', {
        packageSize: filters.packageSize,
      });
    }

    const weightMin = parseOptionalWeightBound(filters.weightMin, 'weightMin');
    const weightMax = parseOptionalWeightBound(filters.weightMax, 'weightMax');
    if (weightMin != null && weightMax != null && weightMin > weightMax) {
      throw new BadRequestException(
        'weightMin nao pode ser maior que weightMax',
      );
    }
    if (weightMin != null) {
      qb.andWhere('delivery.weightKg >= :weightMin', { weightMin });
    }
    if (weightMax != null) {
      qb.andWhere('delivery.weightKg <= :weightMax', { weightMax });
    }

    const isAdmin = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SUPPORT,
    ].includes(user.role);
    if (isAdmin) {
      const filterCustomerId = parseOptionalCustomerId(filters.customerId);
      if (filterCustomerId) {
        qb.andWhere('delivery.customerId = :filterCustomerId', {
          filterCustomerId,
        });
      }
    }

    if (filters.page != null || filters.limit != null) {
      const p = parsePagination(filters.page, filters.limit);
      qb.skip(p.skip).take(p.limit);
      const [items, total] = await qb.getManyAndCount();
      return toPageResult(
        items.map((item) => this.present(item, user)),
        total,
        p.page,
        p.limit,
      );
    }

    return (await qb.getMany()).map((item) => this.present(item, user));
  }

  async listRatings() {
    return this.ratings.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    return this.present(delivery, user);
  }

  async history(id: string, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    return this.events.find({
      where: { deliveryId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async findOffers(userId: string, user: AuthenticatedUser) {
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
    return offers.map((offer) => {
      const delivery = byId.get(offer.deliveryId);
      return {
        ...offer,
        // PICK-01: a oferta também carrega a entrega; passa pelo mesmo recorte
        // para não vazar `pickupCode` pela porta lateral.
        delivery: delivery ? this.present(delivery, user) : undefined,
      };
    });
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

  async acceptOffer(offerId: string, user: AuthenticatedUser) {
    const userId = user.id;
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
      // PICK-01 / DEC-24: o código nasce no aceite e só então o cliente pode
      // vê-lo. Se o pedido já tiver um (reaceite após reabertura), mantém —
      // trocar o número deixaria o cliente com um código velho na mão.
      if (delivery.pickupCode === null) {
        delivery.pickupCode = generatePickupCode();
        delivery.pickupCodeAttempts = 0;
        delivery.pickupCodeBlockedUntil = null;
        delivery.pickupCodeVerifiedAt = null;
      }
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
      // O código vai para o cliente na notificação do aceite: é ele quem
      // precisa ter o número em mãos quando o motoboy chegar.
      await this.notifyCreator(
        delivery,
        'Corrida aceita',
        delivery.pickupCode
          ? `O entregador aceitou a entrega ${delivery.code}. Mostre o código de recolhimento ${delivery.pickupCode} na coleta.`
          : `O entregador aceitou a entrega ${delivery.code}`,
      );
      await this.audit.record({
        actorId: userId,
        action: 'DELIVERY_OFFER_ACCEPTED',
        resourceType: 'delivery',
        resourceId: delivery.id,
        // O valor do código nunca entra na auditoria: o log é lido por gente
        // que não deveria precisar dele para trabalhar.
        metadata: {
          offerId,
          courierId: courier.id,
          pickupCodeIssued: delivery.pickupCode !== null,
        },
      });
      return this.present(delivery, user);
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

  async rejectOffer(offerId: string, user: AuthenticatedUser) {
    const userId = user.id;
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
    return this.present(delivery, user);
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
    if (dto.proofUrl) this.storage.assertAllowedProofUrl(dto.proofUrl);
    if (dto.status === DeliveryStatus.PICKED_UP) {
      // DEC-24: a prova da coleta é do prestador; reapresentar a foto que o
      // cliente enviou na criação não prova recolhimento nenhum.
      if (dto.proofUrl && delivery.productPhotoUrls.includes(dto.proofUrl)) {
        throw new BadRequestException(
          'A foto de coleta precisa ser do prestador, diferente da foto enviada pelo cliente',
        );
      }
      await this.assertPickupCode(delivery, dto, user);
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
    return this.present(delivery, user);
  }

  async rate(id: string, dto: RateDeliveryDto, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    const isCustomer = user.role === UserRole.CUSTOMER;
    if (isCustomer) {
      if (
        delivery.customerId !== user.customerId &&
        delivery.createdById !== user.id
      ) {
        throw new ForbiddenException('Entrega de outro cliente');
      }
    } else {
      throw new ForbiddenException('Somente clientes podem avaliar');
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
        customerId: user.customerId,
        courierId: delivery.courierId,
        score: dto.score,
        comment: dto.comment ?? null,
      }),
    );
  }

  /**
   * PICK-01 / DEC-24 — recorta a entrega conforme quem lê.
   *
   * O prestador **nunca** recebe o valor de `pickupCode`: é ele quem tem de
   * digitar o que o cliente mostrou. Devolver o número ao app do motoboy
   * transformaria o controle em enfeite. O que o app dele recebe é o que
   * precisa para desenhar a tela: se o código é exigido, quantas tentativas
   * restam e até quando está bloqueado.
   *
   * O plano diz "revelado ao prestador no fluxo de coleta"; o que se revela
   * ali é a **exigência** do código, não o segredo — a regra 3 da mesma seção
   * ("prestador informa o código; servidor valida") só fecha assim.
   */
  private present(delivery: Delivery, user: AuthenticatedUser) {
    const {
      pickupCode,
      pickupCodeAttempts,
      pickupCodeOverrideById,
      pickupCodeOverrideReason,
      ...rest
    } = delivery;
    const required = pickupCode !== null;
    const shared = {
      ...rest,
      pickupCodeRequired: required,
      pickupCodeAttemptsLeft: required
        ? Math.max(0, PICKUP_CODE_MAX_ATTEMPTS - pickupCodeAttempts)
        : null,
    };
    if (user.role === UserRole.COURIER) return shared;
    if (STAFF_ROLES.includes(user.role)) {
      return {
        ...shared,
        pickupCode,
        pickupCodeAttempts,
        pickupCodeOverrideById,
        pickupCodeOverrideReason,
      };
    }
    // Cliente: vê o código para mostrar ao prestador na coleta.
    return { ...shared, pickupCode };
  }

  /**
   * PICK-01 / DEC-24 — libera a coleta sem o código, só para admin/suporte,
   * com motivo obrigatório, auditoria e prova alternativa quando existir.
   * Não avança o status: apenas destrava a próxima transição de coleta.
   */
  async overridePickupCode(
    id: string,
    dto: PickupCodeOverrideDto,
    user: AuthenticatedUser,
  ) {
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        'Somente admin ou suporte pode liberar a coleta sem código',
      );
    }
    const delivery = await this.getById(id);
    if (delivery.pickupCode === null) {
      throw new BadRequestException(
        'Este pedido nao usa codigo de recolhimento',
      );
    }
    if (delivery.status !== DeliveryStatus.AT_PICKUP) {
      throw new ConflictException(
        'A liberacao so vale com o pedido em AT_PICKUP',
      );
    }
    if (dto.alternativeProofUrl) {
      this.storage.assertAllowedProofUrl(dto.alternativeProofUrl);
    }
    delivery.pickupCodeVerifiedAt = new Date();
    delivery.pickupCodeAttempts = 0;
    delivery.pickupCodeBlockedUntil = null;
    delivery.pickupCodeOverrideById = user.id;
    delivery.pickupCodeOverrideReason = dto.reason;
    await this.deliveries.save(delivery);
    await this.recordEvent(
      delivery,
      user.id,
      `Coleta liberada sem codigo pelo suporte: ${dto.reason}`,
      dto.alternativeProofUrl,
    );
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_PICKUP_CODE_OVERRIDE',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        reason: dto.reason,
        alternativeProofUrl: dto.alternativeProofUrl ?? null,
        courierId: delivery.courierId,
      },
    });
    await this.notifyCreator(
      delivery,
      'Coleta liberada pelo suporte',
      `A coleta de ${delivery.code} foi liberada sem o código de recolhimento.`,
    );
    return this.present(delivery, user);
  }

  /**
   * PICK-01 — porteiro de `AT_PICKUP → PICKED_UP`.
   *
   * Pedido legado (`pickupCode` nulo) segue pelo comportamento atual: só a foto
   * de coleta. Pedido novo exige código válido **e** foto, e cada erro conta.
   */
  private async assertPickupCode(
    delivery: Delivery,
    dto: UpdateDeliveryStatusDto,
    user: AuthenticatedUser,
  ) {
    if (delivery.pickupCode === null) return;
    if (delivery.pickupCodeVerifiedAt !== null) return;

    const now = new Date();
    if (
      isPickupCodeBlocked(
        {
          attempts: delivery.pickupCodeAttempts,
          blockedUntil: delivery.pickupCodeBlockedUntil,
        },
        now,
      )
    ) {
      const seconds = pickupCodeBlockSecondsLeft(
        {
          attempts: delivery.pickupCodeAttempts,
          blockedUntil: delivery.pickupCodeBlockedUntil,
        },
        now,
      );
      throw new HttpException(
        `Muitas tentativas erradas. Tente de novo em ${Math.ceil(seconds / 60)} min ou peca liberacao ao suporte.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!dto.pickupCode) {
      throw new BadRequestException(
        STAFF_ROLES.includes(user.role)
          ? 'Informe o codigo de recolhimento ou use a liberacao do suporte'
          : 'Informe o codigo de recolhimento que o cliente mostrou',
      );
    }

    if (pickupCodeMatches(delivery.pickupCode, dto.pickupCode)) {
      delivery.pickupCodeVerifiedAt = now;
      delivery.pickupCodeAttempts = 0;
      delivery.pickupCodeBlockedUntil = null;
      await this.audit.record({
        actorId: user.id,
        action: 'DELIVERY_PICKUP_CODE_VERIFIED',
        resourceType: 'delivery',
        resourceId: delivery.id,
        metadata: { code: delivery.code, courierId: delivery.courierId },
      });
      return;
    }

    const failure = registerPickupCodeFailure(
      {
        attempts: delivery.pickupCodeAttempts,
        blockedUntil: delivery.pickupCodeBlockedUntil,
      },
      now,
    );
    delivery.pickupCodeAttempts = failure.attempts;
    delivery.pickupCodeBlockedUntil = failure.blockedUntil;
    await this.deliveries.save(delivery);
    await this.audit.record({
      actorId: user.id,
      action: failure.blockedNow
        ? 'DELIVERY_PICKUP_CODE_BLOCKED'
        : 'DELIVERY_PICKUP_CODE_FAILED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        courierId: delivery.courierId,
        attemptsLeft: failure.attemptsLeft,
        blockedUntil: failure.blockedUntil?.toISOString() ?? null,
      },
    });
    if (failure.blockedNow) {
      // FLOW-DEC-03: o bloqueio vem com alerta. O cliente é quem está na porta
      // com a encomenda, então é ele quem precisa saber agora.
      await this.recordEvent(
        delivery,
        user.id,
        'Codigo de recolhimento bloqueado apos 5 tentativas erradas',
      );
      await this.notifyCreator(
        delivery,
        'Código de recolhimento bloqueado',
        `${delivery.code}: houve 5 tentativas erradas do código. A coleta ficou bloqueada temporariamente.`,
      );
      throw new HttpException(
        'Muitas tentativas erradas. A coleta ficou bloqueada temporariamente; peca liberacao ao suporte.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new BadRequestException(
      `Codigo de recolhimento invalido. Restam ${failure.attemptsLeft} tentativas.`,
    );
  }

  private async createOffer(
    delivery: Delivery,
    courier: Courier,
    actorId: string,
    note: string,
  ) {
    assertDeliveryTransition(delivery.status, DeliveryStatus.OFFERED);
    const platform = await this.settings.get();
    const ttlSeconds = platform.offerTtlSeconds;
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
    if (user.role === UserRole.CUSTOMER) {
      if (
        delivery.customerId === user.customerId ||
        delivery.createdById === user.id
      )
        return;
      throw new ForbiddenException('Acesso negado');
    }
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
    if (user.role === UserRole.CUSTOMER) {
      if (
        target !== DeliveryStatus.CANCELED ||
        (delivery.customerId !== user.customerId &&
          delivery.createdById !== user.id)
      ) {
        throw new ForbiddenException(
          'Cliente pode apenas cancelar seus pedidos',
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
