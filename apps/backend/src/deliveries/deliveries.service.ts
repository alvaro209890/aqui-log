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
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
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
import { TrackingGateway } from '../tracking/tracking.gateway';
import { parsePagination, toPageResult } from '../common/pagination';
import { formatWindowInstant } from '../common/timezone';
import { FULFILLMENT_MODES } from '../pricing/pricing.types';
import { DataSource } from 'typeorm';
import {
  executionWindow,
  hasCapacityConflict,
  isReservedAhead,
  resolveSchedule,
  scheduleExecutionOpen,
  type TimeWindow,
} from './scheduling';
import {
  COURIER_CANCEL_LOCK_TTL_SECONDS,
  DISPATCH_LOCK_TTL_SECONDS,
  OFFER_ACCEPT_LOCK_TTL_SECONDS,
  courierCancelLockKey,
  dispatchLockKey,
  offerAcceptLockKey,
} from './delivery-locks';
import {
  DEFAULT_COURIER_CANCEL_CUTOFFS,
  evaluateCourierCancel,
  type CourierCancelCutoffs,
} from './courier-cancel';
import {
  type DispatchEndReason,
  type DispatchRingConfig,
  type RingSelection,
  describeEndReason,
  dispatchTimeboxExhausted,
  firstWarningDue,
  hasRoundsLeft,
  maxRadiusKm,
  priceBoostProposal,
  RECOVERABLE_END_REASONS,
  roundsUsed,
  selectRingCandidate,
  shouldReopenForWindow,
  timeboxEndReason,
} from './dispatch';
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
  UpdateDeliveryDto,
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
    private readonly dataSource: DataSource,
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
    private readonly tracking: TrackingGateway,
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
    // SCHED-01 / FLOW-DEC-02: a janela é validada ANTES da cotação — não faz
    // sentido calcular preço agendado de uma janela que será recusada.
    const platform = await this.settings.get();
    const schedule = resolveSchedule(
      {
        fulfillmentMode: dto.fulfillmentMode,
        pickupWindowStart: dto.pickupWindowStart,
        pickupWindowEnd: dto.pickupWindowEnd,
        deliveryWindowStart: dto.deliveryWindowStart,
        deliveryWindowEnd: dto.deliveryWindowEnd,
      },
      {
        minLeadMinutes: platform.minScheduleLeadMinutes,
        maxWindowMinutes: platform.scheduleMaxWindowMinutes,
      },
      new Date(),
    );
    // B2C-02 + B2C-06: o preço considera peso, tamanho e agora o MODO — o km
    // do agendado é mais barato que o do imediato (`DEC-19`). O valor usado
    // fica congelado no pedido, então mudar settings depois não o altera.
    const quote = await this.pricing.quoteAsync({
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      fulfillmentMode: dto.fulfillmentMode,
      weightKg: dto.weightKg,
      packageSize: dto.packageSize,
    });
    const delivery = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Delivery, {
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
          // `scheduledAt` é o campo legado de agendamento. Para não deixá-lo
          // mentindo, o agendado o preenche com o início da janela: é isso que
          // faz o redespacho automático (`dispatchDueScheduled`) tentar de novo
          // na hora certa quando ninguém aceitou antes.
          scheduledAt: schedule.pickupWindowStart
            ? schedule.pickupWindowStart
            : dto.scheduledAt
              ? new Date(dto.scheduledAt)
              : null,
          pickupWindowStart: schedule.pickupWindowStart,
          pickupWindowEnd: schedule.pickupWindowEnd,
          deliveryWindowStart: schedule.deliveryWindowStart,
          deliveryWindowEnd: schedule.deliveryWindowEnd,
          // Server-side pricing always wins (client price fields ignored)
          priceCents: quote.priceCents,
          courierFeeCents: quote.courierFeeCents,
          // B2C-02A: congela regra e valores usados (DEC-19).
          pricingVersion: quote.pricingVersion,
          pricingBreakdown: quote.breakdown,
          fulfillmentMode: quote.breakdown.fulfillmentMode,
          kmRateCents: quote.breakdown.kmRateCents,
          courierCancelFeeCents: null,
          collectionProofUrl: null,
          deliveryProofUrl: null,
          canceledAt: null,
        }),
      );
      // PAY-01 / DEC-05: pedido confirmado reserva o preço no ledger do
      // cliente na MESMA transação do save — se o saldo não cobre, o `402`
      // desfaz tudo (produto pré-pago; "dinheiro na entrega" fora de escopo).
      await this.finance.reserve(created, manager);
      return created;
    });
    await this.recordEvent(
      delivery,
      user.id,
      delivery.pickupWindowStart
        ? `Pedido agendado (dist ${quote.distanceKm}km, coleta ${delivery.pickupWindowStart.toISOString()} a ${delivery.pickupWindowEnd?.toISOString()})`
        : `Pedido solicitado (dist ${quote.distanceKm}km)`,
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
        fulfillment: {
          mode: delivery.fulfillmentMode,
          kmRateCents: delivery.kmRateCents,
          pickupWindowStart: delivery.pickupWindowStart?.toISOString() ?? null,
          pickupWindowEnd: delivery.pickupWindowEnd?.toISOString() ?? null,
          deliveryWindowStart:
            delivery.deliveryWindowStart?.toISOString() ?? null,
          deliveryWindowEnd: delivery.deliveryWindowEnd?.toISOString() ?? null,
        },
        pricing: quote,
      },
    });
    // B2C: pedido do cliente é publicado direto para os motoboys próximos.
    // Se não houver motoboy disponível agora, fica REQUESTED e o job de
    // redespacho (expireStaleOffers) tenta de novo quando houver.
    // DEC-20: o agendado entra na fila de ofertas na mesma hora — é isso que
    // permite o aceite antecipado; ele não espera a janela chegar.
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
      fulfillmentMode?: string;
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
    // SCHED-01: separar agendado de imediato é a primeira pergunta da operação
    // quando existem os dois modos na mesma lista.
    if (filters.fulfillmentMode) {
      if (
        !(FULFILLMENT_MODES as readonly string[]).includes(
          filters.fulfillmentMode,
        )
      ) {
        throw new BadRequestException(
          `fulfillmentMode invalido. Use: ${FULFILLMENT_MODES.join(', ')}`,
        );
      }
      qb.andWhere('delivery.fulfillmentMode = :fulfillmentMode', {
        fulfillmentMode: filters.fulfillmentMode,
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
    // DISP-02: o detalhe usa o percentual REAL das settings (Redis) para a
    // proposta de aumento bater com o que o consentimento vai aplicar.
    const platform = await this.settings.get();
    return this.present(delivery, user, platform.dispatchPriceBoostPercent, {
      immediateMinutes: platform.courierCancelCutoffMinutesImmediate,
      scheduledMinutes: platform.courierCancelCutoffMinutesScheduled,
    });
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

  /**
   * DISP-01 / `DEC-03` — uma rodada de reoferta (plano §6.1).
   *
   * Cada chamada tenta **uma** oferta: exclui quem já foi tentado, filtra por
   * agenda livre e escolhe o mais próximo dentro do anel da rodada, ampliando o
   * raio até achar alguém ou esgotar as rodadas configuradas.
   *
   * O ciclo termina em estado **recuperável**: o pedido continua `REQUESTED`,
   * com `dispatch_end_reason` preenchido, e nenhum job insiste depois disso —
   * é isso que impede o loop infinito que o roadmap proíbe. Avisar o cliente e
   * oferecer ação explícita é `DISP-02`; reabrir manualmente já funciona pelo
   * despacho do admin (`reopen`).
   *
   * Preço não é tocado: a reoferta usa o snapshot congelado do pedido
   * (`DEC-19`). Rodada mais cara só com consentimento explícito, em `DISP-02`.
   */
  async dispatch(
    id: string,
    actorId: string,
    options: { reopen?: boolean } = {},
  ) {
    const platform = await this.settings.get();
    const config = this.dispatchConfig(platform);
    const lockKey = dispatchLockKey(id);
    const locked = await this.redis.acquireLock(
      lockKey,
      DISPATCH_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      throw new ConflictException('Despacho em andamento; tente novamente');
    }
    try {
      const delivery = await this.getById(id);
      if (delivery.status !== DeliveryStatus.REQUESTED) {
        throw new ConflictException('A entrega nao esta aguardando despacho');
      }
      const now = new Date();

      if (options.reopen) {
        // Ação de recuperação: admin redespachando ou janela do agendado que
        // chegou. Zera o ciclo — inclusive o motivo de término — mas NÃO apaga
        // as ofertas já feitas: quem recusou continua excluído.
        delivery.dispatchRound = 0;
        delivery.dispatchStartedAt = now;
        delivery.dispatchEndedAt = null;
        delivery.dispatchEndReason = null;
      } else if (delivery.dispatchEndReason) {
        throw new ConflictException(
          `Reoferta encerrada (${describeEndReason(delivery.dispatchEndReason as DispatchEndReason)}). Tente novamente, edite ou cancele o pedido.`,
        );
      } else if (!delivery.dispatchStartedAt) {
        delivery.dispatchStartedAt = now;
      } else if (
        dispatchTimeboxExhausted(delivery.dispatchStartedAt, now, config)
      ) {
        await this.endDispatchCycle(
          delivery,
          timeboxEndReason(delivery),
          actorId,
        );
        throw new NotFoundException(
          `Reoferta encerrada: ${describeEndReason(timeboxEndReason(delivery))}`,
        );
      }

      if (!options.reopen && !hasRoundsLeft(delivery, config)) {
        await this.endDispatchCycle(delivery, 'MAX_ROUNDS', actorId);
        throw new NotFoundException(
          `Reoferta encerrada: ${describeEndReason('MAX_ROUNDS')}`,
        );
      }

      // Plano §6.1.2 — quem já foi tentado não recebe a mesma corrida de novo,
      // tenha ele recusado ou simplesmente deixado a oferta expirar. Reofertar
      // ao mesmo motoboy só queima o TTL outra vez.
      const attempted = await this.offers.findBy({ deliveryId: delivery.id });
      const attemptedIds = new Set(attempted.map((offer) => offer.courierId));
      const available = (
        await this.couriers.findBy({
          status: AccountStatus.ACTIVE,
          available: true,
        })
      ).filter(
        (courier) =>
          courier.lastLatitude !== null &&
          courier.lastLongitude !== null &&
          !attemptedIds.has(courier.id),
      );
      if (!available.length) {
        await this.deliveries.save(delivery);
        throw new NotFoundException(
          'Nenhum entregador disponivel com localizacao',
        );
      }
      const withCapacity = await this.filterByCapacity(delivery, available);
      if (!withCapacity.length) {
        await this.deliveries.save(delivery);
        throw new NotFoundException(
          'Nenhum entregador com agenda livre para esta janela',
        );
      }
      const selection = selectRingCandidate(
        withCapacity.map((courier) => ({
          courierId: courier.id,
          distanceKm: distanceInKm(
            Number(courier.lastLatitude),
            Number(courier.lastLongitude),
            Number(delivery.pickupLatitude),
            Number(delivery.pickupLongitude),
          ),
        })),
        config,
        roundsUsed(delivery) + 1,
      );
      if (!selection) {
        // Ninguém em nenhum anel. Não consome rodada: o freio aqui é a duração
        // total, senão o job (a cada 10 s) gastaria o limite em menos de um
        // minuto enquanto a cidade inteira está offline.
        await this.deliveries.save(delivery);
        throw new NotFoundException(
          `Nenhum entregador dentro de ${maxRadiusKm(config)} km`,
        );
      }
      const courier = withCapacity.find(
        (item) => item.id === selection.courierId,
      ) as Courier;
      return this.createOffer(
        delivery,
        courier,
        actorId,
        `Reoferta rodada ${selection.round} (raio ${selection.radiusKm} km, ${selection.eligibleCount} elegiveis)`,
        { ...selection, attemptedCount: attemptedIds.size + 1 },
      );
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private dispatchConfig(platform: {
    dispatchInitialRadiusKm: number;
    dispatchRingIncrementKm: number;
    dispatchMaxRounds: number;
    dispatchTotalDurationMinutes: number;
  }): DispatchRingConfig {
    return {
      initialRadiusKm: platform.dispatchInitialRadiusKm,
      ringIncrementKm: platform.dispatchRingIncrementKm,
      maxRounds: platform.dispatchMaxRounds,
      totalDurationMinutes: platform.dispatchTotalDurationMinutes,
    };
  }

  /**
   * DISP-01 — fecha o ciclo de reoferta com motivo e carimbo.
   *
   * O pedido **continua `REQUESTED`**: encerrar a busca não é cancelar. O que
   * muda é que nenhum job insiste mais, e o cliente tem um estado explicável
   * para agir (plano §6.1.5).
   *
   * DISP-02 — o término sem aceite vira aviso ao cliente: evento, notificação
   * e WebSocket `delivery:dispatch-ended`. O motivo `ACCEPTED` não passa por
   * aqui (o aceite tem o próprio fluxo e já notifica); `CANCELED` também não.
   */
  private async endDispatchCycle(
    delivery: Delivery,
    reason: DispatchEndReason,
    actorId: string | null,
  ) {
    if (delivery.dispatchEndReason) return;
    delivery.dispatchEndedAt = new Date();
    delivery.dispatchEndReason = reason;
    await this.deliveries.save(delivery);
    await this.recordEvent(
      delivery,
      actorId,
      `Reoferta encerrada: ${describeEndReason(reason)} (rodadas usadas: ${roundsUsed(delivery)})`,
    );
    await this.notifyCreator(
      delivery,
      'Nao encontramos um entregador',
      `${delivery.code}: ${describeEndReason(reason)}. Voce pode tentar de novo, editar ou cancelar o pedido.`,
    );
    this.tracking.emitDispatchEnded(
      delivery.id,
      reason,
      delivery.dispatchEndedAt,
      roundsUsed(delivery),
    );
    await this.audit.record({
      actorId: actorId ?? undefined,
      action: 'DELIVERY_DISPATCH_ENDED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        reason,
        rounds: roundsUsed(delivery),
        startedAt: delivery.dispatchStartedAt?.toISOString() ?? null,
        endedAt: delivery.dispatchEndedAt?.toISOString() ?? null,
      },
    });
  }

  /**
   * SCHED-01 / plano §5.1 — capacidade do prestador.
   *
   * Quem já aceitou um agendado reservou aquela janela. Oferecer-lhe uma
   * corrida que cai dentro dela (com folga dos dois lados) é oferecer algo que
   * ele não pode cumprir: ou ele fura o agendado, ou recusa a oferta e a
   * entrega volta para a fila depois de queimar o TTL.
   *
   * A regra vale nos dois sentidos — imediato que colide com agendado e
   * agendado que colide com agendado. O plano cita o primeiro caso porque é o
   * frequente; o segundo é a mesma reserva vista do outro lado.
   */
  private async filterByCapacity(
    delivery: Delivery,
    candidates: Courier[],
  ): Promise<Courier[]> {
    const platform = await this.settings.get();
    const now = new Date();
    const candidateWindow = executionWindow(
      delivery,
      now,
      platform.immediateExecutionEstimateMinutes,
    );
    // Só o agendado reserva agenda; o imediato em curso já tira o prestador da
    // lista por `available = false`.
    const reservedRows = await this.deliveries.find({
      where: {
        courierId: In(candidates.map((courier) => courier.id)),
        fulfillmentMode: 'SCHEDULED',
        status: In([
          DeliveryStatus.ACCEPTED,
          DeliveryStatus.AT_PICKUP,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.IN_TRANSIT,
        ]),
        pickupWindowEnd: MoreThanOrEqual(now),
      },
    });
    const reservedByCourier = new Map<string, TimeWindow[]>();
    for (const row of reservedRows) {
      if (row.id === delivery.id) continue;
      if (!row.courierId || !row.pickupWindowStart || !row.pickupWindowEnd) {
        continue;
      }
      const list = reservedByCourier.get(row.courierId) ?? [];
      list.push({
        start: new Date(row.pickupWindowStart),
        end: new Date(row.pickupWindowEnd),
      });
      reservedByCourier.set(row.courierId, list);
    }
    if (reservedByCourier.size === 0) return candidates;
    return candidates.filter(
      (courier) =>
        !hasCapacityConflict(
          candidateWindow,
          reservedByCourier.get(courier.id) ?? [],
          platform.scheduleCapacitySlackMinutes,
        ),
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
      // DISP-01: o ciclo de reoferta acabou aqui, e com o melhor desfecho.
      // `DISP-03` vai medir "rodada e raio do aceite" a partir destes campos.
      delivery.dispatchEndedAt = new Date();
      delivery.dispatchEndReason = 'ACCEPTED';
      // PICK-01 / DEC-24: o código nasce no aceite e só então o cliente pode
      // vê-lo. Se o pedido já tiver um (reaceite após reabertura), mantém —
      // trocar o número deixaria o cliente com um código velho na mão.
      if (delivery.pickupCode === null) {
        delivery.pickupCode = generatePickupCode();
        delivery.pickupCodeAttempts = 0;
        delivery.pickupCodeBlockedUntil = null;
        delivery.pickupCodeVerifiedAt = null;
      }
      // DEC-20: o aceite congela também a taxa de cancelamento vigente. Mudar
      // a multa no admin depois não pode alterar o que já foi combinado.
      const platform = await this.settings.get();
      if (delivery.courierCancelFeeCents === null) {
        delivery.courierCancelFeeCents = platform.courierCancelFeeCents;
      }
      // Aceite antecipado de agendado NÃO tira o prestador do mercado: a
      // janela dele é lá na frente, e marcá-lo indisponível agora faria o
      // `DEC-20` custar horas de trabalho. Quem protege a janela é o filtro de
      // capacidade em `filterByCapacity`.
      const reservedAhead = isReservedAhead(delivery, new Date());
      if (!reservedAhead) courier.available = false;
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
          // DEC-20: o que foi congelado no aceite.
          fulfillmentMode: delivery.fulfillmentMode,
          earlyAccept: reservedAhead,
          courierFeeCents: delivery.courierFeeCents,
          courierCancelFeeCents: delivery.courierCancelFeeCents,
        },
      });
      return this.present(delivery, user, undefined, {
        immediateMinutes: platform.courierCancelCutoffMinutesImmediate,
        scheduledMinutes: platform.courierCancelCutoffMinutesScheduled,
      });
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
    const now = new Date();
    const due = await this.deliveries.find({
      where: {
        status: DeliveryStatus.REQUESTED,
        scheduledAt: LessThanOrEqual(now),
      },
      take: 20,
      order: { scheduledAt: 'ASC' },
    });
    // Also only those with non-null scheduledAt
    const withSchedule = due.filter((d) => d.scheduledAt !== null);
    let count = 0;
    for (const delivery of withSchedule) {
      try {
        // DISP-01: a chegada da janela é ocasião nova — o ciclo que morreu na
        // criação (aceite antecipado sem candidato) recomeça uma única vez.
        // `shouldReopenForWindow` é auto-idempotente, então o tick de 10 s não
        // vira um reinício perpétuo.
        await this.dispatch(delivery.id, delivery.createdById, {
          reopen: shouldReopenForWindow(delivery, now),
        });
        count += 1;
      } catch {
        // skip if no couriers
      }
    }
    return count;
  }

  /**
   * DISP-01 — mantém o ciclo de anéis andando enquanto ele estiver vivo.
   *
   * Sem este job a ampliação de raio não aconteceria: um pedido imediato que
   * nasceu sem ninguém por perto ficava `REQUESTED` para sempre, porque
   * `expireStaleOffers` só olha oferta pendente e `dispatchDueScheduled` só
   * olha agendado. Pedido com ciclo já encerrado é ignorado — é o que impede o
   * loop infinito.
   */
  async redispatchPendingRequested(): Promise<number> {
    const pending = await this.deliveries.find({
      where: {
        status: DeliveryStatus.REQUESTED,
        dispatchEndReason: IsNull(),
        scheduledAt: IsNull(),
      },
      take: 20,
      order: { createdAt: 'ASC' },
    });
    let count = 0;
    for (const delivery of pending) {
      try {
        await this.dispatch(delivery.id, delivery.createdById);
        count += 1;
      } catch {
        // sem candidato agora, ou ciclo encerrado nesta tentativa
      }
    }
    return count;
  }

  /**
   * `DISP-02` / plano §6.1.4 — aviso do "primeiro atraso significativo".
   *
   * O job roda a cada 10 s; este passo olha só pedidos com busca **ativa**
   * (ciclo começou e não terminou) que ainda não foram avisados. O marco fica
   * em `dispatch_warning_at` — é a coluna que impede o aviso repetido.
   *
   * O cliente recebe o aviso por três canais: evento no histórico, notificação
   * e WebSocket `delivery:{id}` (`delivery:warning`). Nada aqui reabre nem
   * encerra ciclo: é aviso, não intervenção.
   */
  async warnSlowDispatch(): Promise<number> {
    const platform = await this.settings.get();
    // Busca ativa inclui `OFFERED`: o ciclo continua em andamento enquanto há
    // oferta pendente aguardando o motoboy aceitar/recusar/expirar (o caso
    // comum, já que o despacho roda logo na criação). Filtrar só por
    // `REQUESTED` fazia o aviso nunca disparar com oferta pendente no
    // instante da checagem — o cliente só veria o aviso nas raras janelas
    // entre rodadas sem oferta ativa.
    const active = await this.deliveries.find({
      where: {
        status: In([DeliveryStatus.REQUESTED, DeliveryStatus.OFFERED]),
        dispatchEndReason: IsNull(),
        dispatchWarningAt: IsNull(),
      },
      take: 20,
      order: { createdAt: 'ASC' },
    });
    let count = 0;
    const now = new Date();
    for (const delivery of active) {
      if (
        !firstWarningDue(
          delivery.dispatchStartedAt,
          now,
          platform.dispatchFirstWarningMinutes,
        )
      ) {
        continue;
      }
      delivery.dispatchWarningAt = now;
      await this.deliveries.save(delivery);
      await this.recordEvent(
        delivery,
        null,
        'Aviso de demora: ainda procurando um entregador para o seu pedido',
      );
      await this.notifyCreator(
        delivery,
        'Ainda procurando um entregador',
        `${delivery.code}: ainda nao encontramos um entregador. Continue acompanhando o pedido.`,
      );
      this.tracking.emitFirstWarning(delivery.id, now);
      count += 1;
    }
    return count;
  }

  /**
   * `DISP-02` / plano §6.1.5 — "tentar de novo" do cliente.
   *
   * É o mesmo caminho de recuperação do admin (`dispatch(id, actorId,
   * { reopen: true })`, handoff de `DISP-01`): o ciclo esgotado recomeça do
   * anel 1 e quem já foi tentado continua de fora. A diferença é a validação
   * por papel: só o dono do pedido, e só quando há o que tentar de novo.
   *
   * Ciclo ainda ativo (motivo vazio e começado) não tem o que reabrir: o job
   * já está tentando a cada 10 s — responder `409` evita colidir com o lock.
   */
  async retry(id: string, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    if (delivery.status !== DeliveryStatus.REQUESTED) {
      throw new ConflictException('A entrega nao esta aguardando despacho');
    }
    if (delivery.dispatchEndReason === null && delivery.dispatchStartedAt) {
      throw new ConflictException(
        'A busca por entregador ja esta em andamento; tente novamente em instantes.',
      );
    }
    if (delivery.dispatchEndReason === 'CANCELED') {
      throw new ConflictException('Pedido cancelado nao pode ser retentado');
    }
    // Motivo recuperável (`MAX_ROUNDS`/`TIMEBOX`/`NO_CANDIDATE`) ou ciclo que
    // nunca começou: reabre. Sem candidato no momento, o `dispatch` devolve
    // `404` e o pedido continua REQUESTED com o ciclo reaberto (o job segue).
    try {
      await this.dispatch(id, user.id, { reopen: true });
    } catch (error) {
      // Sem candidato agora não é falha do retry: o ciclo foi reaberto e o
      // job `redispatchPendingRequested` continua tentando. Devolver o pedido
      // em vez de propagar o 404 (o cliente pediu para tentar de novo).
      if (!(error instanceof NotFoundException)) throw error;
    }
    // Devolve o pedido recortado por papel (sem `pickupCode` para o prestador,
    // com proposta de aumento para o cliente), não o par cru do dispatch.
    const platform = await this.settings.get();
    return this.present(
      await this.getById(id),
      user,
      platform.dispatchPriceBoostPercent,
    );
  }

  /**
   * `DISP-02` / plano §6.1.5 — "editar" do pedido com busca esgotada.
   *
   * Endereços, destinatário, telefone, observação e (no agendado) janelas. O
   * que mexe em preço (peso, tipo, tamanho, fotos, escopo) fica de fora por
   * `DEC-19`: o DTO nem aceita esses campos (`forbidNonWhitelisted`).
   *
   * Regras de segurança:
   * - só em `REQUESTED` — aceito/em trânsito não se edita;
   * - nunca com oferta pendente — o motoboy que viu a oferta leria o endereço
   *   velho;
   * - latitude e longitude andam juntas (o DTO valida cada uma; aqui o par);
   * - janela no imediato é recusada; no agendado, o conjunto final é
   *   revalidado com a mesma regra da criação (`resolveSchedule`);
   * - editar NÃO reabre a busca e NÃO limpa o motivo de término: a ação de
   *   reabrir é o "tentar de novo", explícita (plano §6.1.5).
   */
  async updateDelivery(
    id: string,
    dto: UpdateDeliveryDto,
    user: AuthenticatedUser,
  ) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    if (delivery.status !== DeliveryStatus.REQUESTED) {
      throw new ConflictException(
        'O pedido so pode ser editado enquanto aguarda entregador',
      );
    }
    const pending = await this.offers.findOneBy({
      deliveryId: delivery.id,
      status: OfferStatus.PENDING,
    });
    if (pending) {
      throw new ConflictException(
        'Ha uma oferta pendente para este pedido; aguarde a resposta do entregador',
      );
    }

    const patch: Partial<Delivery> = {};
    if (dto.pickupAddress !== undefined)
      patch.pickupAddress = dto.pickupAddress;
    if (dto.deliveryAddress !== undefined)
      patch.deliveryAddress = dto.deliveryAddress;
    if (dto.recipientName !== undefined)
      patch.recipientName = dto.recipientName;
    if (dto.recipientPhone !== undefined)
      patch.recipientPhone = dto.recipientPhone;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.pickupLatitude !== undefined || dto.pickupLongitude !== undefined) {
      if (
        dto.pickupLatitude === undefined ||
        dto.pickupLongitude === undefined
      ) {
        throw new BadRequestException(
          'Informe latitude e longitude da coleta juntas',
        );
      }
      patch.pickupLatitude = dto.pickupLatitude;
      patch.pickupLongitude = dto.pickupLongitude;
    }
    if (
      dto.deliveryLatitude !== undefined ||
      dto.deliveryLongitude !== undefined
    ) {
      if (
        dto.deliveryLatitude === undefined ||
        dto.deliveryLongitude === undefined
      ) {
        throw new BadRequestException(
          'Informe latitude e longitude da entrega juntas',
        );
      }
      patch.deliveryLatitude = dto.deliveryLatitude;
      patch.deliveryLongitude = dto.deliveryLongitude;
    }

    const hasWindowFields =
      dto.pickupWindowStart !== undefined ||
      dto.pickupWindowEnd !== undefined ||
      dto.deliveryWindowStart !== undefined ||
      dto.deliveryWindowEnd !== undefined;
    if (hasWindowFields) {
      if (delivery.fulfillmentMode !== 'SCHEDULED') {
        throw new BadRequestException(
          'Janela de coleta so faz sentido no modo agendado',
        );
      }
      const platform = await this.settings.get();
      const schedule = resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart:
            dto.pickupWindowStart ??
            delivery.pickupWindowStart?.toISOString() ??
            undefined,
          pickupWindowEnd:
            dto.pickupWindowEnd ??
            delivery.pickupWindowEnd?.toISOString() ??
            undefined,
          deliveryWindowStart:
            dto.deliveryWindowStart ??
            delivery.deliveryWindowStart?.toISOString() ??
            undefined,
          deliveryWindowEnd:
            dto.deliveryWindowEnd ??
            delivery.deliveryWindowEnd?.toISOString() ??
            undefined,
        },
        {
          minLeadMinutes: platform.minScheduleLeadMinutes,
          maxWindowMinutes: platform.scheduleMaxWindowMinutes,
        },
        new Date(),
      );
      patch.pickupWindowStart = schedule.pickupWindowStart;
      patch.pickupWindowEnd = schedule.pickupWindowEnd;
      patch.deliveryWindowStart = schedule.deliveryWindowStart;
      patch.deliveryWindowEnd = schedule.deliveryWindowEnd;
      // `scheduledAt` (legado) continua espelhando o início da janela.
      patch.scheduledAt = schedule.pickupWindowStart;
    }

    Object.assign(delivery, patch);
    await this.deliveries.save(delivery);
    await this.recordEvent(delivery, user.id, 'Pedido editado pelo cliente');
    this.tracking.emitDeliveryUpdated(delivery.id);
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_UPDATED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        fields: Object.keys(patch),
        windowsChanged: hasWindowFields,
      },
    });
    const platform = await this.settings.get();
    return this.present(delivery, user, platform.dispatchPriceBoostPercent);
  }

  /**
   * `DISP-02` / `DEC-03` §3.3 — consentimento explícito do aumento de valor.
   *
   * Nunca silencioso: o cliente só chega aqui vendo a proposta (valor anterior
   * → valor novo + motivo) no próprio pedido. Este endpoint aplica o novo
   * snapshot **e reabre a busca** com ele — e grava a trilha completa:
   *
   * 1. evento no histórico com anterior → novo;
   * 2. auditoria `DELIVERY_PRICE_BOOST_CONSENTED`;
   * 3. WebSocket `delivery:price-boosted`;
   * 4. breakdown do pedido anotado (`boost.previousPriceCents`).
   *
   * Requisitos: pedido `REQUESTED` com ciclo esgotado em motivo recuperável e
   * percentual de aumento configurado (> 0). Sem candidato no momento, o
   * `dispatch` devolve `404` e o pedido continua com o novo preço e o ciclo
   * reaberto.
   */
  async consentPriceBoost(id: string, user: AuthenticatedUser) {
    const delivery = await this.getById(id);
    await this.ensureCanView(delivery, user);
    if (delivery.status !== DeliveryStatus.REQUESTED) {
      throw new ConflictException('A entrega nao esta aguardando despacho');
    }
    if (
      !delivery.dispatchEndReason ||
      !RECOVERABLE_END_REASONS.includes(
        delivery.dispatchEndReason as DispatchEndReason,
      )
    ) {
      throw new ConflictException(
        'O aumento so pode ser consentido quando a busca esgotou sem entregador',
      );
    }
    const platform = await this.settings.get();
    const proposal = priceBoostProposal(
      delivery.priceCents,
      platform.dispatchPriceBoostPercent,
    );
    if (!proposal) {
      throw new NotFoundException('Nenhum aumento de valor configurado');
    }

    const previousPrice = delivery.priceCents;
    const newPrice = proposal.newPriceCents;
    const platformFee = Math.round(
      (newPrice * platform.pricingPlatformFeePercent) / 100,
    );
    const courierFee = newPrice - platformFee;
    delivery.priceCents = newPrice;
    delivery.courierFeeCents = courierFee;
    delivery.pricingBreakdown = {
      ...(delivery.pricingBreakdown ?? {
        version: delivery.pricingVersion ?? 1,
        fulfillmentMode: (delivery.fulfillmentMode ?? 'IMMEDIATE') as never,
        distanceKm: 0,
        kmRateCents: delivery.kmRateCents ?? 0,
        baseFeeCents: 0,
        distanceCents: 0,
        weightKg: null,
        weightBandUpToKg: null,
        weightSurchargeCents: 0,
        packageSize: null,
        sizeSurchargeCents: 0,
        subtotalCents: 0,
        minFeeCents: 0,
        minFeeApplied: false,
        platformFeePercent: platform.pricingPlatformFeePercent,
      }),
      platformFeePercent: platform.pricingPlatformFeePercent,
      boost: {
        previousPriceCents: previousPrice,
        boostPercent: proposal.boostPercent,
        boostedAt: new Date().toISOString(),
      },
    };
    await this.deliveries.save(delivery);
    await this.recordEvent(
      delivery,
      user.id,
      `Aumento consentido: ${this.brl(previousPrice)} para ${this.brl(newPrice)} (+${proposal.boostPercent}%) para destravar a busca`,
    );
    this.tracking.emitPriceBoosted(delivery.id, previousPrice, newPrice);
    await this.audit.record({
      actorId: user.id,
      action: 'DELIVERY_PRICE_BOOST_CONSENTED',
      resourceType: 'delivery',
      resourceId: delivery.id,
      metadata: {
        code: delivery.code,
        previousPriceCents: previousPrice,
        newPriceCents: newPrice,
        boostPercent: proposal.boostPercent,
        platformFeeCents: platformFee,
        courierFeeCents: courierFee,
      },
    });
    // O novo preço vale para a busca que recomeça agora.
    try {
      await this.dispatch(delivery.id, user.id, { reopen: true });
    } catch {
      // sem candidato agora — o pedido segue REQUESTED, com o novo preço e o
      // ciclo reaberto; o job continua tentando.
    }
    return this.present(
      await this.getById(id),
      user,
      platform.dispatchPriceBoostPercent,
    );
  }

  private brl(cents: number): string {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
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
    // DISP-01 / plano §6.1.2: recusa dispara a rodada seguinte na hora, com o
    // anel maior e sem este motoboy. Antes deste pacote, um imediato recusado
    // ficava parado até um admin redespachar — nenhum job olhava para ele.
    try {
      await this.dispatch(delivery.id, userId);
    } catch {
      // sem candidato, rodadas esgotadas ou tempo esgotado: o pedido continua
      // REQUESTED, agora com motivo de término registrado.
    }
    return this.present(await this.getById(delivery.id), user);
  }

  /**
   * COUR-02 / DEC-22 — desistência do prestador antes da coleta.
   *
   * Não é `PATCH .../status CANCELED`: isso encerraria o pedido e devolveria
   * a reserva do cliente. Aqui o pedido volta a `REQUESTED`, a taxa congelada
   * no aceite sai do saldo do motoboy, e a busca reabre sem ele (quem já foi
   * tentado continua excluído pelas ofertas).
   */
  async cancelByCourier(id: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.COURIER) {
      throw new ForbiddenException(
        'Somente o entregador da corrida pode desistir por este fluxo',
      );
    }
    const lockKey = courierCancelLockKey(id);
    const locked = await this.redis.acquireLock(
      lockKey,
      COURIER_CANCEL_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      throw new ConflictException(
        'Cancelamento em processamento; tente novamente',
      );
    }
    try {
      const courier = await this.getCourierByUser(user.id);
      const delivery = await this.getById(id);
      if (delivery.courierId !== courier.id) {
        throw new ForbiddenException('Entrega de outro entregador');
      }
      const platform = await this.settings.get();
      const cutoffs: CourierCancelCutoffs = {
        immediateMinutes: platform.courierCancelCutoffMinutesImmediate,
        scheduledMinutes: platform.courierCancelCutoffMinutesScheduled,
      };
      const verdict = evaluateCourierCancel(delivery, cutoffs, new Date());
      if (!verdict.allowed) {
        throw new ConflictException(verdict.reason ?? 'Cancelamento recusado');
      }
      const fee = delivery.courierCancelFeeCents ?? 0;
      const previousCourierId = delivery.courierId;
      await this.dataSource.transaction(async (manager) => {
        await this.finance.debitCourierCancelFee(delivery, manager);
        delivery.status = DeliveryStatus.REQUESTED;
        delivery.courierId = null;
        await manager.save(Delivery, delivery);
      });
      await this.couriers.update(previousCourierId, { available: true });
      const feeNote =
        fee > 0 ? ` taxa de ${this.brl(fee)} debitada` : ' sem taxa';
      await this.recordEvent(
        delivery,
        user.id,
        `Prestador desistiu da corrida;${feeNote}`,
      );
      await this.notifyCreator(
        delivery,
        'Entregador desistiu da corrida',
        `${delivery.code}: o entregador desistiu. Estamos procurando outro.`,
      );
      await this.audit.record({
        actorId: user.id,
        action: 'COURIER_CANCELED',
        resourceType: 'delivery',
        resourceId: delivery.id,
        metadata: {
          courierId: previousCourierId,
          feeCents: fee,
          fulfillmentMode: delivery.fulfillmentMode,
          deadline: verdict.deadline?.toISOString() ?? null,
        },
      });
      this.tracking.emitDeliveryUpdated(delivery.id);
      try {
        await this.dispatch(id, user.id, { reopen: true });
      } catch {
        // Sem candidato agora: o pedido segue REQUESTED e o job continua.
      }
      return this.present(await this.getById(id), user, undefined, cutoffs);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateDeliveryStatusDto,
    user: AuthenticatedUser,
  ) {
    const delivery = await this.getById(id);
    await this.ensureCanTransition(delivery, dto.status, user);
    assertDeliveryTransition(delivery.status, dto.status);
    if (dto.status === DeliveryStatus.AT_PICKUP) {
      this.assertScheduleWindowOpen(delivery, user);
    }
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
    if (dto.status === DeliveryStatus.CANCELED) {
      delivery.canceledAt = new Date();
      // DISP-01: cancelar fecha o ciclo de reoferta; nenhum job deve continuar
      // procurando motoboy para um pedido que não existe mais.
      if (!delivery.dispatchEndReason) {
        delivery.dispatchEndedAt = new Date();
        delivery.dispatchEndReason = 'CANCELED';
      }
    }
    // PAY-01 / DEC-05: liquidação e liberação da reserva acontecem na MESMA
    // transação do status — o ledger nunca diverge do estado da entrega.
    await this.dataSource.transaction(async (manager) => {
      await manager.save(Delivery, delivery);
      if (dto.status === DeliveryStatus.DELIVERED) {
        await this.finance.settle(delivery, manager);
      }
      if (dto.status === DeliveryStatus.CANCELED) {
        await this.finance.release(delivery, manager);
      }
    });
    await this.recordEvent(delivery, user.id, dto.note ?? null, dto.proofUrl);
    if (
      [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELED].includes(
        dto.status,
      ) &&
      delivery.courierId
    ) {
      await this.couriers.update(delivery.courierId, { available: true });
    }
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
  private present(
    delivery: Delivery,
    user: AuthenticatedUser,
    boostPercent?: number,
    cancelCutoffs?: CourierCancelCutoffs,
  ) {
    const {
      pickupCode,
      pickupCodeAttempts,
      pickupCodeOverrideById,
      pickupCodeOverrideReason,
      ...rest
    } = delivery;
    const required = pickupCode !== null;
    const shared: {
      [key: string]: unknown;
      pickupCodeRequired: boolean;
      pickupCodeAttemptsLeft: number | null;
    } = {
      ...rest,
      pickupCodeRequired: required,
      pickupCodeAttemptsLeft: required
        ? Math.max(0, PICKUP_CODE_MAX_ATTEMPTS - pickupCodeAttempts)
        : null,
    };
    // DISP-02 / DEC-03 §3.3 — a proposta de aumento de valor para destravar a
    // busca esgotada é só do cliente (e de staff, que atua em nome dele):
    // revelar ao motoboy que um aumento está para ser oferecido deixaria a
    // recusa estratégica (recusar de propósito para forçar o valor subir)
    // valer a pena. Por isso o cálculo fica DEPOIS do retorno antecipado do
    // `COURIER`, no mesmo espírito do corte de `pickupCode` acima.
    if (user.role === UserRole.COURIER) {
      // COUR-02: o botão de cancelar no app lê estes campos. A taxa já vai
      // em `courierCancelFeeCents` (congelada no aceite). O recorte do
      // `pickupCode` permanece — desistir não revela o código.
      const verdict = evaluateCourierCancel(
        delivery,
        cancelCutoffs ?? DEFAULT_COURIER_CANCEL_CUTOFFS,
      );
      return {
        ...shared,
        courierCancelAllowed: verdict.allowed,
        courierCancelUntil: verdict.deadline
          ? verdict.deadline.toISOString()
          : null,
      };
    }
    // Só existe quando o ciclo terminou em motivo recuperável e há percentual
    // configurado > 0. É ela que o app mostra antes de pedir consentimento —
    // nunca o contrário. O percentual real (Redis) é passado por quem leu as
    // settings; o default do env cobre os fluxos de lista.
    const effectiveBoostPercent = boostPercent ?? this.settingsBoostPercent();
    if (
      delivery.status === DeliveryStatus.REQUESTED &&
      delivery.dispatchEndReason &&
      RECOVERABLE_END_REASONS.includes(
        delivery.dispatchEndReason as DispatchEndReason,
      )
    ) {
      shared.priceBoostProposal = priceBoostProposal(
        delivery.priceCents,
        effectiveBoostPercent,
      );
    } else {
      shared.priceBoostProposal = null;
    }
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
   * DISP-02 — leitura síncrona do percentual de aumento. O `present` não é
   * assíncrono; o valor só participa de decisão aqui e a proposta é
   * recalculada no consentimento (que lê settings de verdade).
   */
  private settingsBoostPercent(): number {
    const raw = this.config.get<string | undefined>(
      'DISPATCH_PRICE_BOOST_PERCENT',
    );
    const parsed = Number(raw ?? 20);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
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
   * SCHED-01 / DEC-20 — a execução do agendado só "abre" na janela.
   *
   * Entre o aceite antecipado e o início da janela o pedido vive na agenda do
   * prestador. Deixar `ACCEPTED → AT_PICKUP` passar antes disso convidaria o
   * motoboy a bater na porta do cliente horas antes do combinado.
   *
   * Admin/suporte passam: eles operam exceção, e travá-los aqui só criaria
   * chamado sem saída quando cliente e prestador se acertarem por fora.
   */
  private assertScheduleWindowOpen(
    delivery: Delivery,
    user: AuthenticatedUser,
  ) {
    if (STAFF_ROLES.includes(user.role)) return;
    if (scheduleExecutionOpen(delivery, new Date())) return;
    const start = delivery.pickupWindowStart as Date;
    throw new ConflictException(
      `A coleta agendada abre em ${formatWindowInstant(start)}. Antes disso o pedido fica na agenda.`,
    );
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
    // DISP-01: presente quando a oferta veio de uma rodada de anel. Nulo no
    // despacho dirigido do admin (`assign`), que escolhe a dedo e não é rodada.
    ring?: RingSelection & { attemptedCount: number },
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
        // Plano §6.2: a rodada registra raio, elegíveis e tentados. É a matéria
        // -prima da telemetria de `DISP-03`.
        dispatchRound: ring?.round ?? null,
        radiusKm: ring?.radiusKm ?? null,
        eligibleCount: ring?.eligibleCount ?? null,
        attemptedCount: ring?.attemptedCount ?? null,
      }),
    );
    delivery.courierId = courier.id;
    delivery.status = DeliveryStatus.OFFERED;
    if (ring) {
      delivery.dispatchRound = ring.round;
      if (!delivery.dispatchStartedAt) delivery.dispatchStartedAt = new Date();
    } else {
      // Despacho dirigido reabre a busca: existe oferta pendente de novo, então
      // deixar o pedido marcado como "reoferta encerrada" seria mentira.
      delivery.dispatchEndedAt = null;
      delivery.dispatchEndReason = null;
      if (!delivery.dispatchStartedAt) delivery.dispatchStartedAt = new Date();
    }
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
    if (target === DeliveryStatus.CANCELED) {
      throw new BadRequestException(
        'Para desistir da corrida use POST /deliveries/:id/courier-cancel',
      );
    }
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
