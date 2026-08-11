import {
  LedgerEntryDirection,
  LedgerOwnerType,
  LedgerTransactionStatus,
  LedgerTransactionType,
} from '../database/enums';
import type { FinancialAccount } from '../database/entities/financial-account.entity';

/**
 * PAY-01 — regras puras do ledger (plano de pagamentos §2/§3).
 *
 * O que se prova aqui sem banco: a soma de cada transação fecha em zero, os
 * valores são inteiros positivos, o estado da reserva segue a máquina
 * `RESERVED → SETTLED | RELEASED`, e a chave idempotente de cada operação é
 * determinística por objeto de negócio.
 */

/**
 * Conta da plataforma usada como contrapartida (contas fixas). `ownerId` é um
 * UUID canônico fixo porque a coluna é `uuid` e a plataforma é uma só.
 */
export const PLATFORM_OWNER: Readonly<{
  ownerType: LedgerOwnerType.PLATFORM;
  ownerId: string;
}> = {
  ownerType: LedgerOwnerType.PLATFORM,
  ownerId: '00000000-0000-4000-8000-000000000000',
};

/** Direção inversa de um lançamento (a contrapartida fecha a soma em zero). */
export function opposite(
  direction: LedgerEntryDirection,
): LedgerEntryDirection {
  return direction === LedgerEntryDirection.DEBIT
    ? LedgerEntryDirection.CREDIT
    : LedgerEntryDirection.DEBIT;
}

export interface LedgerPosting {
  account: FinancialAccount;
  direction: LedgerEntryDirection;
  amountCents: number;
}

/** Lançamentos somam zero (créditos − débitos) e valores são inteiros positivos. */
export function assertBalanced(postings: readonly LedgerPosting[]): void {
  const sign = (direction: LedgerEntryDirection) =>
    direction === LedgerEntryDirection.CREDIT ? 1 : -1;
  const sum = postings.reduce(
    (total, p) => total + sign(p.direction) * p.amountCents,
    0,
  );
  if (sum !== 0) {
    throw new Error(`Transacao do ledger desbalanceada (soma ${sum} != 0)`);
  }
  for (const posting of postings) {
    if (!Number.isInteger(posting.amountCents) || posting.amountCents <= 0) {
      throw new Error(
        `Valor do lançamento precisa ser inteiro positivo, veio ${posting.amountCents}`,
      );
    }
  }
}

/**
 * Movimento de reserva de um pedido: cliente disponível → cliente reservado.
 * `assertBalanced` garante que isso não cria dinheiro.
 */
export function buildReservationPostings(
  customerAvailable: FinancialAccount,
  customerReserved: FinancialAccount,
  priceCents: number,
): LedgerPosting[] {
  return [
    {
      account: customerAvailable,
      direction: LedgerEntryDirection.DEBIT,
      amountCents: priceCents,
    },
    {
      account: customerReserved,
      direction: LedgerEntryDirection.CREDIT,
      amountCents: priceCents,
    },
  ];
}

/**
 * Liberação da reserva (cancelamento/expiração): cliente reservado →
 * cliente disponível. Espelha a reserva.
 */
export function buildReleasePostings(
  customerAvailable: FinancialAccount,
  customerReserved: FinancialAccount,
  priceCents: number,
): LedgerPosting[] {
  return [
    {
      account: customerReserved,
      direction: LedgerEntryDirection.DEBIT,
      amountCents: priceCents,
    },
    {
      account: customerAvailable,
      direction: LedgerEntryDirection.CREDIT,
      amountCents: priceCents,
    },
  ];
}

/**
 * Liquidação em `DELIVERED`: a reserva vira receita da plataforma (preço
 * menos o repasse) e obrigação contábil com o motoboy (o repasse). Soma zero:
 * `price = (price − courierFee) + courierFee`.
 */
export function buildSettlementPostings(
  customerReserved: FinancialAccount,
  platformRevenue: FinancialAccount,
  courierAvailable: FinancialAccount,
  priceCents: number,
  courierFeeCents: number,
): LedgerPosting[] {
  return [
    {
      account: customerReserved,
      direction: LedgerEntryDirection.DEBIT,
      amountCents: priceCents,
    },
    {
      account: platformRevenue,
      direction: LedgerEntryDirection.CREDIT,
      amountCents: priceCents - courierFeeCents,
    },
    {
      account: courierAvailable,
      direction: LedgerEntryDirection.CREDIT,
      amountCents: courierFeeCents,
    },
  ];
}

/** Estado que a máquina da reserva (§4.1) aceita a partir de `current`. */
export function nextReservationStatus(
  current: LedgerTransactionStatus,
  operation: 'SETTLE' | 'RELEASE',
): LedgerTransactionStatus {
  if (current === LedgerTransactionStatus.RESERVED) {
    return operation === 'SETTLE'
      ? LedgerTransactionStatus.SETTLED
      : LedgerTransactionStatus.RELEASED;
  }
  return current;
}

/** Chave idempotente determinística de cada operação de domínio. */
export function reservationKey(deliveryId: string): string {
  return `reserve:delivery:${deliveryId}`;
}

export function releaseKey(deliveryId: string): string {
  return `release:delivery:${deliveryId}`;
}

export function settlementKey(deliveryId: string): string {
  return `settle:delivery:${deliveryId}`;
}

export function adjustmentKey(clientKey: string): string {
  return `adjust:${clientKey}`;
}

/** Rótulo legível do extrato para cada tipo de transação. */
export function describeTransaction(
  type: LedgerTransactionType,
  metadata: Record<string, unknown>,
  ownerType: LedgerOwnerType = LedgerOwnerType.CUSTOMER,
): string {
  const code =
    typeof metadata.deliveryCode === 'string' ? metadata.deliveryCode : '';
  switch (type) {
    case LedgerTransactionType.RESERVATION:
      return `Reserva do pedido ${code}`.trim();
    case LedgerTransactionType.RESERVATION_RELEASE:
      return `Estorno da reserva do pedido ${code}`.trim();
    case LedgerTransactionType.SETTLEMENT:
      return ownerType === LedgerOwnerType.COURIER
        ? `Credito da entrega ${code}`.trim()
        : `Entrega concluida ${code}`.trim();
    case LedgerTransactionType.ADJUSTMENT: {
      const reason = metadata.reason;
      return typeof reason === 'string' && reason.length > 0
        ? reason
        : 'Ajuste administrativo';
    }
  }
}
