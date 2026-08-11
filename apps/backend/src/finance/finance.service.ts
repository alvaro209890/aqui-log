import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { PaymentRequiredException } from '../common/payment-required.exception';
import { Courier } from '../database/entities/courier.entity';
import { Customer } from '../database/entities/customer.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { FinancialAccount } from '../database/entities/financial-account.entity';
import { LedgerEntry } from '../database/entities/ledger-entry.entity';
import { LedgerTransaction } from '../database/entities/ledger-transaction.entity';
import {
  DeliveryStatus,
  LedgerAccountPurpose,
  LedgerEntryDirection,
  LedgerOwnerType,
  LedgerTransactionStatus,
  LedgerTransactionType,
} from '../database/enums';
import {
  adjustmentKey,
  assertBalanced,
  buildReleasePostings,
  buildReservationPostings,
  buildSettlementPostings,
  describeTransaction,
  opposite,
  PLATFORM_OWNER,
  releaseKey,
  reservationKey,
  settlementKey,
} from './ledger-rules';

const OWNER_TYPES: LedgerOwnerType[] = [
  LedgerOwnerType.CUSTOMER,
  LedgerOwnerType.COURIER,
];

export interface AdjustInput {
  actor?: { id: string | null } | null;
  ownerType: LedgerOwnerType;
  ownerId: string;
  amountCents: number;
  reason: string;
  idempotencyKey?: string;
}

export interface StatementEntry {
  id: string;
  type: LedgerTransactionType;
  amountCents: number;
  description: string;
  createdAt: Date;
}

export interface StatementResult {
  availableCents: number;
  reservedCents: number;
  balanceCents: number;
  entries: StatementEntry[];
}

interface LedgerPosting {
  account: FinancialAccount;
  direction: LedgerEntryDirection;
  amountCents: number;
}

/**
 * PAY-01 — ledger interno sem gateway (`DEC-05`).
 *
 * Contabilidade de partidas balanceadas sobre `financial_accounts` +
 * `ledger_transactions` + `ledger_entries`. Invariantes do plano §2:
 * soma dos lançamentos de cada transação = zero; valores inteiros positivos
 * no contrato; ledger nunca editado/apagado (correção por transação reversa);
 * chave idempotente por operação; saldo disponível nunca negativo; operações
 * financeiras dentro de transação de banco com `FOR UPDATE` nas contas.
 *
 * A carteira MVP do motoboy (`wallet_transactions`) evoluiu para este ledger
 * (`DEC-23`): a liquidação em `DELIVERED` credita a conta do prestador aqui e
 * `wallet_transactions` ficou congelada como registro histórico (nada mais é
 * escrito nela).
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(FinancialAccount)
    private readonly accounts: Repository<FinancialAccount>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerTransactions: Repository<LedgerTransaction>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntries: Repository<LedgerEntry>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ contas

  private async account(
    manager: EntityManager,
    ownerType: LedgerOwnerType,
    ownerId: string,
    purpose: LedgerAccountPurpose,
  ): Promise<FinancialAccount> {
    await manager
      .getRepository(FinancialAccount)
      .createQueryBuilder()
      .insert()
      .values({ ownerType, ownerId, purpose })
      .orIgnore()
      .execute();
    return manager.findOneByOrFail(FinancialAccount, {
      ownerType,
      ownerId,
      purpose,
    });
  }

  /** Lock em todas as contas envolvidas, em ordem estável (evita deadlock). */
  private async lockAccounts(
    manager: EntityManager,
    accounts: FinancialAccount[],
  ): Promise<void> {
    const ordered = [...accounts].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const account of ordered) {
      await manager.getRepository(FinancialAccount).findOne({
        where: { id: account.id },
        lock: { mode: 'pessimistic_write' },
      });
    }
  }

  private async balanceOf(
    manager: EntityManager,
    accountId: string,
  ): Promise<number> {
    const row = await manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('entry')
      .select(
        'COALESCE(SUM(CASE WHEN entry.direction = :credit THEN entry.amountCents ELSE entry.amountCents * -1 END), 0)',
        'balanceCents',
      )
      .where('entry.accountId = :accountId', { accountId })
      .setParameter('credit', LedgerEntryDirection.CREDIT)
      .getRawOne<{ balanceCents: string }>();
    return Number(row?.balanceCents ?? 0);
  }

  // --------------------------------------------------- transação do ledger

  private async applyTransaction(
    manager: EntityManager,
    input: {
      type: LedgerTransactionType;
      referenceType: string;
      referenceId: string;
      idempotencyKey: string;
      status: LedgerTransactionStatus;
      metadata: Record<string, unknown>;
    },
    postings: LedgerPosting[],
  ): Promise<LedgerTransaction> {
    assertBalanced(postings);
    const existing = await manager.findOneBy(LedgerTransaction, {
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) return existing;
    const transaction = await manager.save(
      manager.create(LedgerTransaction, input),
    );
    if (postings.length > 0) {
      await manager.save(
        manager.create(
          LedgerEntry,
          postings.map((posting) => ({
            transactionId: transaction.id,
            accountId: posting.account.id,
            direction: posting.direction,
            amountCents: posting.amountCents,
          })),
        ),
      );
    }
    return transaction;
  }

  /** Executa dentro do manager recebido ou abre transação própria. */
  private run<T>(
    manager: EntityManager | undefined,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return manager ? fn(manager) : this.dataSource.transaction(fn);
  }

  // ---------------------------------------------------- operações de domínio

  /**
   * Reserva atômica ao confirmar o pedido (plano §5.3). Pedido sem saldo
   * suficiente é recusado com `402` (produto pré-pago: "dinheiro na entrega"
   * está fora de escopo, plano §9). Idempotente por `reserve:delivery:<id>`.
   */
  reserve(delivery: Delivery, manager?: EntityManager) {
    if (!delivery.customerId || delivery.priceCents <= 0) return null;
    return this.run(manager, async (m) => {
      const available = await this.account(
        m,
        LedgerOwnerType.CUSTOMER,
        delivery.customerId!,
        LedgerAccountPurpose.AVAILABLE,
      );
      const reserved = await this.account(
        m,
        LedgerOwnerType.CUSTOMER,
        delivery.customerId!,
        LedgerAccountPurpose.RESERVED,
      );
      await this.lockAccounts(m, [available, reserved]);
      const existing = await m.findOneBy(LedgerTransaction, {
        idempotencyKey: reservationKey(delivery.id),
      });
      if (existing) return existing;
      const availableCents = await this.balanceOf(m, available.id);
      if (availableCents < delivery.priceCents) {
        throw new PaymentRequiredException(
          'Saldo insuficiente para reservar o valor da entrega. Adicione credito de teste antes de criar o pedido.',
        );
      }
      return this.applyTransaction(
        m,
        {
          type: LedgerTransactionType.RESERVATION,
          referenceType: 'delivery',
          referenceId: delivery.id,
          idempotencyKey: reservationKey(delivery.id),
          status: LedgerTransactionStatus.RESERVED,
          metadata: { deliveryCode: delivery.code },
        },
        buildReservationPostings(available, reserved, delivery.priceCents),
      );
    });
  }

  /**
   * Liberação da reserva em cancelamento/expiração (plano §5.4): devolve o
   * valor ao disponível. Idempotente por `release:delivery:<id>`; pedido
   * nunca reservado registra liberação vazia (sem lançamentos).
   */
  release(delivery: Delivery, manager?: EntityManager) {
    if (!delivery.customerId || delivery.priceCents <= 0) return null;
    return this.run(manager, async (m) => {
      const available = await this.account(
        m,
        LedgerOwnerType.CUSTOMER,
        delivery.customerId!,
        LedgerAccountPurpose.AVAILABLE,
      );
      const reserved = await this.account(
        m,
        LedgerOwnerType.CUSTOMER,
        delivery.customerId!,
        LedgerAccountPurpose.RESERVED,
      );
      await this.lockAccounts(m, [available, reserved]);
      const existing = await m.findOneBy(LedgerTransaction, {
        idempotencyKey: releaseKey(delivery.id),
      });
      if (existing) return existing;
      const reservation = await m.findOneBy(LedgerTransaction, {
        referenceType: 'delivery',
        referenceId: delivery.id,
        type: LedgerTransactionType.RESERVATION,
      });
      if (
        !reservation ||
        reservation.status !== LedgerTransactionStatus.RESERVED
      ) {
        return this.applyTransaction(
          m,
          {
            type: LedgerTransactionType.RESERVATION_RELEASE,
            referenceType: 'delivery',
            referenceId: delivery.id,
            idempotencyKey: releaseKey(delivery.id),
            status: LedgerTransactionStatus.COMPLETED,
            metadata: {
              deliveryCode: delivery.code,
              released: false,
              reason: reservation
                ? `reserva em ${reservation.status}`
                : 'pedido sem reserva',
            },
          },
          [],
        );
      }
      reservation.status = LedgerTransactionStatus.RELEASED;
      await m.save(reservation);
      return this.applyTransaction(
        m,
        {
          type: LedgerTransactionType.RESERVATION_RELEASE,
          referenceType: 'delivery',
          referenceId: delivery.id,
          idempotencyKey: releaseKey(delivery.id),
          status: LedgerTransactionStatus.COMPLETED,
          metadata: { deliveryCode: delivery.code },
        },
        buildReleasePostings(available, reserved, delivery.priceCents),
      );
    });
  }

  /**
   * Liquidação idempotente em `DELIVERED` (plano §5.5): a reserva vira
   * receita da plataforma (preço − repasse) e obrigação contábil com o
   * motoboy (repasse), sem payout real (`DEC-23`). Idempotente por
   * `settle:delivery:<id>`.
   */
  settle(delivery: Delivery, manager?: EntityManager) {
    if (
      !delivery.courierId ||
      delivery.courierFeeCents <= 0 ||
      !delivery.customerId
    ) {
      return null;
    }
    return this.run(manager, async (m) => {
      const customerReserved = await this.account(
        m,
        LedgerOwnerType.CUSTOMER,
        delivery.customerId!,
        LedgerAccountPurpose.RESERVED,
      );
      const platformRevenue = await this.account(
        m,
        PLATFORM_OWNER.ownerType,
        PLATFORM_OWNER.ownerId,
        LedgerAccountPurpose.RESERVED,
      );
      const courierAvailable = await this.account(
        m,
        LedgerOwnerType.COURIER,
        delivery.courierId!,
        LedgerAccountPurpose.AVAILABLE,
      );
      await this.lockAccounts(m, [
        customerReserved,
        platformRevenue,
        courierAvailable,
      ]);
      const existing = await m.findOneBy(LedgerTransaction, {
        idempotencyKey: settlementKey(delivery.id),
      });
      if (existing) return existing;
      const reservation = await m.findOneBy(LedgerTransaction, {
        referenceType: 'delivery',
        referenceId: delivery.id,
        type: LedgerTransactionType.RESERVATION,
      });
      const covered =
        !!reservation &&
        reservation.status === LedgerTransactionStatus.RESERVED;
      if (reservation && covered) {
        reservation.status = LedgerTransactionStatus.SETTLED;
        await m.save(reservation);
      }
      return this.applyTransaction(
        m,
        {
          type: LedgerTransactionType.SETTLEMENT,
          referenceType: 'delivery',
          referenceId: delivery.id,
          idempotencyKey: settlementKey(delivery.id),
          status: LedgerTransactionStatus.COMPLETED,
          metadata: {
            deliveryCode: delivery.code,
            uncovered: !covered,
          },
        },
        buildSettlementPostings(
          customerReserved,
          platformRevenue,
          courierAvailable,
          delivery.priceCents,
          delivery.courierFeeCents,
        ),
      );
    });
  }

  /**
   * Ajuste administrativo auditado (plano §5.8): crédito/débito de teste na
   * conta `AVAILABLE` de um participante, com motivo obrigatório e
   * contrapartida na conta de capital da plataforma. Débito maior que o
   * saldo é recusado (`409`); replay com a mesma chave retorna o anterior.
   */
  async adjust(input: AdjustInput): Promise<LedgerTransaction> {
    if (!OWNER_TYPES.includes(input.ownerType)) {
      throw new BadRequestException('Tipo de conta invalido');
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
      throw new BadRequestException(
        'amountCents deve ser um inteiro diferente de zero',
      );
    }
    const reason = input.reason?.trim();
    if (!reason || reason.length < 5) {
      throw new BadRequestException(
        'Motivo obrigatorio com pelo menos 5 caracteres',
      );
    }
    const key = adjustmentKey(input.idempotencyKey?.trim() || randomUUID());
    return this.dataSource.transaction(async (m) => {
      const participant = await this.account(
        m,
        input.ownerType,
        input.ownerId,
        LedgerAccountPurpose.AVAILABLE,
      );
      const platform = await this.account(
        m,
        PLATFORM_OWNER.ownerType,
        PLATFORM_OWNER.ownerId,
        LedgerAccountPurpose.AVAILABLE,
      );
      await this.lockAccounts(m, [participant, platform]);
      const existing = await m.findOneBy(LedgerTransaction, {
        idempotencyKey: key,
      });
      if (existing) return existing;
      const balance = await this.balanceOf(m, participant.id);
      if (input.amountCents < 0 && balance + input.amountCents < 0) {
        throw new ConflictException(
          'Saldo insuficiente para debitar: ajuste deixaria o saldo negativo',
        );
      }
      const absolute = Math.abs(input.amountCents);
      const direction =
        input.amountCents > 0
          ? LedgerEntryDirection.CREDIT
          : LedgerEntryDirection.DEBIT;
      const transaction = await this.applyTransaction(
        m,
        {
          type: LedgerTransactionType.ADJUSTMENT,
          referenceType: 'adjust',
          referenceId: key,
          idempotencyKey: key,
          status: LedgerTransactionStatus.COMPLETED,
          metadata: {
            reason,
            actorId: input.actor?.id ?? null,
            ownerType: input.ownerType,
            ownerId: input.ownerId,
          },
        },
        [
          { account: participant, direction, amountCents: absolute },
          {
            account: platform,
            direction: opposite(direction),
            amountCents: absolute,
          },
        ],
      );
      await this.audit.record({
        actorId: input.actor?.id ?? null,
        action: 'FINANCE_ADJUSTMENT',
        resourceType: 'financial_account',
        resourceId: participant.id,
        metadata: {
          amountCents: input.amountCents,
          reason,
          ledgerTransactionId: transaction.id,
        },
      });
      return transaction;
    });
  }

  // ---------------------------------------------------------------- extrato

  /** Saldo reconstruído do ledger para um participante. */
  async statement(
    ownerType: LedgerOwnerType,
    ownerId: string,
  ): Promise<StatementResult> {
    if (!OWNER_TYPES.includes(ownerType)) {
      throw new BadRequestException('Tipo de conta invalido');
    }
    const accounts = await this.accounts.find({
      where: [
        { ownerType, ownerId, purpose: LedgerAccountPurpose.AVAILABLE },
        { ownerType, ownerId, purpose: LedgerAccountPurpose.RESERVED },
      ],
    });
    const availableAccount = accounts.find(
      (account) => account.purpose === LedgerAccountPurpose.AVAILABLE,
    );
    const reservedAccount = accounts.find(
      (account) => account.purpose === LedgerAccountPurpose.RESERVED,
    );
    const [availableCents, reservedCents] = await Promise.all([
      availableAccount
        ? this.balanceOf(this.dataSource.manager, availableAccount.id)
        : Promise.resolve(0),
      reservedAccount
        ? this.balanceOf(this.dataSource.manager, reservedAccount.id)
        : Promise.resolve(0),
    ]);
    const involvedIds = accounts.map((account) => account.id);
    const entries: StatementEntry[] = [];
    if (involvedIds.length > 0) {
      // Uma entrada por TRANSAÇÃO com o efeito no saldo disponível (pernas da
      // conta AVAILABLE do dono). Pernas de RESERVED aparecem como reservedCents
      // no topo, não como movimento — reserva = -preço, liberação = +preço.
      const rows = await this.ledgerEntries
        .createQueryBuilder('entry')
        .select('txn.id', 'transactionId')
        .addSelect('txn.type', 'type')
        .addSelect('txn.metadata', 'metadata')
        .addSelect('txn.createdAt', 'createdAt')
        .addSelect(
          `SUM(CASE WHEN entry.direction = :credit THEN entry.amount_cents ELSE -entry.amount_cents END)`,
          'amountCents',
        )
        .innerJoin(LedgerTransaction, 'txn', 'txn.id = entry.transactionId')
        .where('entry.accountId = :availableId', {
          availableId: availableAccount?.id ?? '',
        })
        .setParameter('credit', LedgerEntryDirection.CREDIT)
        .groupBy('txn.id')
        .addGroupBy('txn.type')
        .addGroupBy('txn.metadata')
        .addGroupBy('txn.createdAt')
        .orderBy('txn.createdAt', 'DESC')
        .take(200)
        .getRawMany<{
          transactionId: string;
          type: LedgerTransactionType;
          metadata: Record<string, unknown>;
          amountCents: string;
          createdAt: Date;
        }>();
      for (const row of rows) {
        entries.push({
          id: row.transactionId,
          type: row.type,
          amountCents: Number(row.amountCents),
          description: describeTransaction(row.type, row.metadata, ownerType),
          createdAt: row.createdAt,
        });
      }
    }
    return {
      availableCents,
      reservedCents,
      balanceCents: availableCents,
      entries,
    };
  }

  /** Resolve a conta do participante a partir do usuário autenticado. */
  async resolveOwner(
    userId: string,
    role: 'CUSTOMER' | 'COURIER',
  ): Promise<{ ownerType: LedgerOwnerType; ownerId: string }> {
    if (role === 'COURIER') {
      const courier = await this.couriers.findOneBy({ userId });
      if (!courier) throw new NotFoundException('Entregador nao encontrado');
      return { ownerType: LedgerOwnerType.COURIER, ownerId: courier.id };
    }
    const customer = await this.customers.findOneBy({ userId });
    if (!customer) throw new NotFoundException('Cliente nao encontrado');
    return { ownerType: LedgerOwnerType.CUSTOMER, ownerId: customer.id };
  }

  // ---------------------------------------------------------------- resumo

  async summary() {
    const query = this.deliveries
      .createQueryBuilder('delivery')
      .select('COALESCE(SUM(delivery.priceCents), 0)', 'grossCents')
      .addSelect(
        'COALESCE(SUM(delivery.courierFeeCents), 0)',
        'courierCostCents',
      )
      .addSelect('COUNT(*)', 'deliveredCount')
      .where('delivery.status = :status', { status: DeliveryStatus.DELIVERED });

    const result = await query.getRawOne<{
      grossCents: string;
      courierCostCents: string;
      deliveredCount: string;
    }>();
    const grossCents = Number(result?.grossCents ?? 0);
    const courierCostCents = Number(result?.courierCostCents ?? 0);

    const rows = await this.ledgerEntries
      .createQueryBuilder('entry')
      .innerJoin(FinancialAccount, 'account', 'account.id = entry.accountId')
      .select('account.ownerType', 'ownerType')
      .addSelect('account.purpose', 'purpose')
      .addSelect(
        'COALESCE(SUM(CASE WHEN entry.direction = :credit THEN entry.amount_cents ELSE -entry.amount_cents END), 0)',
        'balanceCents',
      )
      .where(
        '(account.ownerType = :courier AND account.purpose = :available) OR (account.ownerType = :customer AND account.purpose IN (:...purposes)) OR (account.ownerType = :platform)',
        {
          courier: LedgerOwnerType.COURIER,
          available: LedgerAccountPurpose.AVAILABLE,
          customer: LedgerOwnerType.CUSTOMER,
          purposes: [
            LedgerAccountPurpose.AVAILABLE,
            LedgerAccountPurpose.RESERVED,
          ],
          platform: LedgerOwnerType.PLATFORM,
        },
      )
      .groupBy('account.ownerType')
      .addGroupBy('account.purpose')
      .setParameter('credit', LedgerEntryDirection.CREDIT)
      .getRawMany<{
        ownerType: LedgerOwnerType;
        purpose: LedgerAccountPurpose;
        balanceCents: string;
      }>();

    const pick = (ownerType: LedgerOwnerType, purpose: LedgerAccountPurpose) =>
      Number(
        rows.find(
          (row) => row.ownerType === ownerType && row.purpose === purpose,
        )?.balanceCents ?? 0,
      );

    return {
      grossCents,
      courierCostCents,
      marginCents: grossCents - courierCostCents,
      deliveredCount: Number(result?.deliveredCount ?? 0),
      courierObligationCents: pick(
        LedgerOwnerType.COURIER,
        LedgerAccountPurpose.AVAILABLE,
      ),
      customerAvailableCents: pick(
        LedgerOwnerType.CUSTOMER,
        LedgerAccountPurpose.AVAILABLE,
      ),
      customerReservedCents: pick(
        LedgerOwnerType.CUSTOMER,
        LedgerAccountPurpose.RESERVED,
      ),
      platformRevenueCents: pick(
        LedgerOwnerType.PLATFORM,
        LedgerAccountPurpose.RESERVED,
      ),
      platformCapitalCents: pick(
        LedgerOwnerType.PLATFORM,
        LedgerAccountPurpose.AVAILABLE,
      ),
    };
  }
}
