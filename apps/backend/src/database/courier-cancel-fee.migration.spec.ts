import { QueryRunner } from 'typeorm';
import { CourierCancelFeeLedger1785900000000 } from './migrations/1785900000000-CourierCancelFeeLedger';

describe('CourierCancelFeeLedger1785900000000', () => {
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

  it('so adiciona o valor COURIER_CANCEL_FEE no enum do ledger', async () => {
    const { queries, queryRunner } = createRunner();
    await new CourierCancelFeeLedger1785900000000().up(queryRunner);
    const sql = queries.join('\n');
    expect(sql).toContain(
      `ALTER TYPE "public"."ledger_transaction_type_enum" ADD VALUE 'COURIER_CANCEL_FEE'`,
    );
    expect(sql).not.toContain('ALTER TABLE "deliveries"');
    expect(sql).not.toContain('wallet_transactions');
  });

  it('rollback recria o enum sem o valor novo', async () => {
    const { queries, queryRunner } = createRunner();
    await new CourierCancelFeeLedger1785900000000().down(queryRunner);
    const sql = queries.join('\n');
    expect(sql).toContain('DROP TYPE "public"."ledger_transaction_type_enum"');
    expect(sql).toContain(
      `CREATE TYPE "public"."ledger_transaction_type_enum" AS ENUM('ADJUSTMENT', 'RESERVATION', 'RESERVATION_RELEASE', 'SETTLEMENT')`,
    );
    expect(sql).not.toContain('COURIER_CANCEL_FEE');
  });
});
