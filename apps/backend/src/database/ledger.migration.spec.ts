import { QueryRunner } from 'typeorm';
import { LedgerInternal1785800000000 } from './migrations/1785800000000-LedgerInternal';

describe('LedgerInternal1785800000000', () => {
  const createRunner = () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      }),
    } as unknown as QueryRunner;
    return { queries, queryRunner };
  };

  it('cria as tres tabelas do ledger com enums, FKs e CHECK de valor positivo', async () => {
    const { queries, queryRunner } = createRunner();

    await new LedgerInternal1785800000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(queries.length).toBeGreaterThan(10);
    expect(sql).toContain('CREATE TABLE "financial_accounts"');
    expect(sql).toContain('CREATE TABLE "ledger_transactions"');
    expect(sql).toContain('CREATE TABLE "ledger_entries"');
    expect(sql).toContain('CREATE TYPE "public"."ledger_owner_type_enum"');
    expect(sql).toContain(
      'CREATE TYPE "public"."ledger_transaction_status_enum"',
    );
    expect(sql).toContain('UNIQUE INDEX "IDX_financial_accounts_owner"');
    expect(sql).toContain('UNIQUE INDEX "IDX_ledger_transactions_idempotency"');
    expect(sql).toContain('CHECK ("amount_cents" > 0)');
    // Chamada aditiva: nenhuma tabela existente e reescrita ou tocada.
    expect(sql).not.toContain('wallet_transactions');
    expect(sql).not.toContain('ALTER TABLE "deliveries"');
  });

  it('rollback derruba apenas o que foi criado', async () => {
    const { queries, queryRunner } = createRunner();

    await new LedgerInternal1785800000000().down(queryRunner);

    const sql = queries.join('\n');
    const drops = queries.filter((q) => q.startsWith('DROP'));
    expect(drops.length).toBeGreaterThan(8);
    expect(sql).toContain('DROP TABLE IF EXISTS "ledger_entries"');
    expect(sql).toContain('DROP TABLE IF EXISTS "ledger_transactions"');
    expect(sql).toContain('DROP TABLE IF EXISTS "financial_accounts"');
    expect(sql).toContain(
      'DROP TYPE IF EXISTS "public"."ledger_owner_type_enum"',
    );
    expect(sql).not.toContain('deliveries');
  });
});
