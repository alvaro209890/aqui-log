import { QueryRunner } from 'typeorm';
import { DeliveryPickupCode1785400000000 } from './migrations/1785400000000-DeliveryPickupCode';

describe('DeliveryPickupCode1785400000000', () => {
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

  it('e aditiva: o codigo entra opcional, para nao quebrar pedido legado', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryPickupCode1785400000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(queries).toHaveLength(6);
    expect(sql).toContain('ADD "pickup_code" character varying(8)');
    expect(sql).toContain(
      'ADD "pickup_code_attempts" integer NOT NULL DEFAULT 0',
    );
    expect(sql).toContain('ADD "pickup_code_blocked_until"');
    expect(sql).toContain('ADD "pickup_code_verified_at"');
    expect(sql).toContain('ADD "pickup_code_override_by_id" uuid');
    expect(sql).toContain('ADD "pickup_code_override_reason" text');
    // Só o contador pode ser NOT NULL, e ele traz DEFAULT: nenhuma linha
    // existente é rejeitada pela migration.
    expect(sql.match(/NOT NULL/g)).toHaveLength(1);
    expect(
      queries.every((q) => q.startsWith('ALTER TABLE "deliveries" ADD')),
    ).toBe(true);
  });

  it('o rollback derruba exatamente as colunas criadas', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryPickupCode1785400000000().down(queryRunner);

    expect(queries).toHaveLength(6);
    expect(queries.every((q) => q.includes('DROP COLUMN'))).toBe(true);
    expect(queries.at(-1)).toContain('"pickup_code"');
  });
});
