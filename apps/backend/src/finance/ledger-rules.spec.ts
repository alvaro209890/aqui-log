import {
  LedgerEntryDirection,
  LedgerOwnerType,
  LedgerTransactionStatus,
  LedgerTransactionType,
} from '../database/enums';
import { FinancialAccount } from '../database/entities/financial-account.entity';
import {
  adjustmentKey,
  assertBalanced,
  buildReleasePostings,
  buildReservationPostings,
  buildSettlementPostings,
  describeTransaction,
  nextReservationStatus,
  PLATFORM_OWNER,
  releaseKey,
  reservationKey,
  settlementKey,
} from './ledger-rules';

function account(
  ownerType: LedgerOwnerType,
  purpose: string,
): FinancialAccount {
  return Object.assign(new FinancialAccount(), {
    id: `${ownerType}-${purpose}`,
    ownerType,
    ownerId:
      ownerType === LedgerOwnerType.PLATFORM ? 'main' : `acc-${ownerType}`,
    purpose,
  });
}

const CUSTOMER_AVAILABLE = account(LedgerOwnerType.CUSTOMER, 'AVAILABLE');
const CUSTOMER_RESERVED = account(LedgerOwnerType.CUSTOMER, 'RESERVED');
const COURIER_AVAILABLE = account(LedgerOwnerType.COURIER, 'AVAILABLE');
const PLATFORM_REVENUE = account(LedgerOwnerType.PLATFORM, 'RESERVED');

describe('PAY-01 — regras puras do ledger (plano §2/§3)', () => {
  it('reserva move disponivel -> reservado sem criar dinheiro (soma zero)', () => {
    const postings = buildReservationPostings(
      CUSTOMER_AVAILABLE,
      CUSTOMER_RESERVED,
      1380,
    );
    assertBalanced(postings);
    expect(postings).toHaveLength(2);
    const [available, reserved] = postings;
    expect(available).toMatchObject({
      direction: LedgerEntryDirection.DEBIT,
      amountCents: 1380,
    });
    expect(reserved).toMatchObject({
      direction: LedgerEntryDirection.CREDIT,
      amountCents: 1380,
    });
  });

  it('liberacao espelha a reserva e tambem fecha em zero', () => {
    const postings = buildReleasePostings(
      CUSTOMER_AVAILABLE,
      CUSTOMER_RESERVED,
      1380,
    );
    assertBalanced(postings);
    const [reserved, available] = postings;
    expect(reserved).toMatchObject({
      direction: LedgerEntryDirection.DEBIT,
      amountCents: 1380,
    });
    expect(available).toMatchObject({
      direction: LedgerEntryDirection.CREDIT,
      amountCents: 1380,
    });
  });

  it('liquidacao distribui preco = fee da plataforma + repasse do motoboy', () => {
    const postings = buildSettlementPostings(
      CUSTOMER_RESERVED,
      PLATFORM_REVENUE,
      COURIER_AVAILABLE,
      1380,
      1104,
    );
    assertBalanced(postings);
    const byAccount = Object.fromEntries(
      postings.map((p) => [p.account.id, p]),
    );
    expect(byAccount[CUSTOMER_RESERVED.id].direction).toBe(
      LedgerEntryDirection.DEBIT,
    );
    expect(byAccount[CUSTOMER_RESERVED.id].amountCents).toBe(1380);
    expect(byAccount[PLATFORM_REVENUE.id].amountCents).toBe(1380 - 1104);
    expect(byAccount[PLATFORM_REVENUE.id].direction).toBe(
      LedgerEntryDirection.CREDIT,
    );
    expect(byAccount[COURIER_AVAILABLE.id].amountCents).toBe(1104);
    expect(byAccount[COURIER_AVAILABLE.id].direction).toBe(
      LedgerEntryDirection.CREDIT,
    );
  });

  it('valores precisam ser inteiros positivos', () => {
    expect(() =>
      assertBalanced(
        buildReservationPostings(CUSTOMER_AVAILABLE, CUSTOMER_RESERVED, 13.8),
      ),
    ).toThrow(/inteiro positivo/);
    expect(() =>
      assertBalanced(
        buildReservationPostings(CUSTOMER_AVAILABLE, CUSTOMER_RESERVED, -1),
      ),
    ).toThrow(/inteiro positivo/);
    expect(() =>
      assertBalanced(
        buildReservationPostings(CUSTOMER_AVAILABLE, CUSTOMER_RESERVED, 0),
      ),
    ).toThrow(/inteiro positivo/);
  });

  it('a maquina da reserva so avanca de RESERVED para SETTLED|RELEASED', () => {
    expect(
      nextReservationStatus(LedgerTransactionStatus.RESERVED, 'SETTLE'),
    ).toBe(LedgerTransactionStatus.SETTLED);
    expect(
      nextReservationStatus(LedgerTransactionStatus.RESERVED, 'RELEASE'),
    ).toBe(LedgerTransactionStatus.RELEASED);
    expect(
      nextReservationStatus(LedgerTransactionStatus.SETTLED, 'RELEASE'),
    ).toBe(LedgerTransactionStatus.SETTLED);
    expect(
      nextReservationStatus(LedgerTransactionStatus.RELEASED, 'SETTLE'),
    ).toBe(LedgerTransactionStatus.RELEASED);
  });

  it('chaves idempotentes sao deterministicas por operacao e pedido', () => {
    expect(reservationKey('d-1')).toBe('reserve:delivery:d-1');
    expect(releaseKey('d-1')).toBe('release:delivery:d-1');
    expect(settlementKey('d-1')).toBe('settle:delivery:d-1');
    expect(adjustmentKey('client-key')).toBe('adjust:client-key');
    expect(reservationKey('d-1')).not.toBe(releaseKey('d-1'));
  });

  it('a conta da plataforma e fixa (owner PLATFORM com UUID canonico)', () => {
    expect(PLATFORM_OWNER).toEqual({
      ownerType: LedgerOwnerType.PLATFORM,
      ownerId: '00000000-0000-4000-8000-000000000000',
    });
  });

  it('extrato legivel: reserva, estorno, liquidação e ajuste', () => {
    const metadata = { deliveryCode: 'AQL-1' };
    expect(
      describeTransaction(
        LedgerTransactionType.RESERVATION,
        metadata,
        LedgerOwnerType.CUSTOMER,
      ),
    ).toBe('Reserva do pedido AQL-1');
    expect(
      describeTransaction(
        LedgerTransactionType.RESERVATION_RELEASE,
        metadata,
        LedgerOwnerType.CUSTOMER,
      ),
    ).toBe('Estorno da reserva do pedido AQL-1');
    expect(
      describeTransaction(
        LedgerTransactionType.SETTLEMENT,
        metadata,
        LedgerOwnerType.COURIER,
      ),
    ).toBe('Credito da entrega AQL-1');
    expect(
      describeTransaction(
        LedgerTransactionType.SETTLEMENT,
        metadata,
        LedgerOwnerType.CUSTOMER,
      ),
    ).toBe('Entrega concluida AQL-1');
    expect(
      describeTransaction(
        LedgerTransactionType.ADJUSTMENT,
        { reason: 'Credito de teste PAY-01' },
        LedgerOwnerType.CUSTOMER,
      ),
    ).toBe('Credito de teste PAY-01');
  });
});
