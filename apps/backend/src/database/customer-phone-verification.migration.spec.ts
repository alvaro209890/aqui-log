import { QueryRunner } from 'typeorm';
import { CustomerPhoneVerification1786000000000 } from './migrations/1786000000000-CustomerPhoneVerification';

describe('CustomerPhoneVerification1786000000000', () => {
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

  it('so adiciona colunas em customers, sem reescrever linhas', async () => {
    const { queries, queryRunner } = createRunner();
    await new CustomerPhoneVerification1786000000000().up(queryRunner);
    const sql = queries.join('\n');
    expect(sql).toContain('ALTER TABLE "customers" ADD "phone_verified_at"');
    expect(sql).toContain('ADD "phone_challenge_hash"');
    expect(sql).not.toContain('ALTER TABLE "deliveries"');
    expect(sql).not.toContain('UPDATE "customers"');
  });

  it('rollback derruba so as colunas novas', async () => {
    const { queries, queryRunner } = createRunner();
    await new CustomerPhoneVerification1786000000000().down(queryRunner);
    const sql = queries.join('\n');
    expect(sql).toContain('DROP COLUMN IF EXISTS "phone_verified_at"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "phone_challenge_hash"');
    expect(sql).not.toContain('DROP TABLE');
  });
});
