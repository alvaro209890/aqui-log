import { QueryRunner } from 'typeorm';
import { DeliveryScheduling1785500000000 } from './migrations/1785500000000-DeliveryScheduling';

describe('DeliveryScheduling1785500000000', () => {
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

  it('e aditiva: janelas e valores congelados entram opcionais', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryScheduling1785500000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(queries).toHaveLength(8);
    expect(sql).toContain('ADD "km_rate_cents" integer');
    expect(sql).toContain('ADD "pickup_window_start" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain('ADD "pickup_window_end" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain(
      'ADD "delivery_window_start" TIMESTAMP WITH TIME ZONE',
    );
    expect(sql).toContain('ADD "delivery_window_end" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain('ADD "courier_cancel_fee_cents" integer');
    // Nenhuma coluna NOT NULL e nenhum default: pedido legado sobrevive à
    // migration sem ser reescrito, e continua sendo lido como IMMEDIATE pela
    // coluna `fulfillment_mode`, que já existe desde o B2C-02A.
    expect(sql).not.toContain('NOT NULL');
    expect(sql).not.toContain('DEFAULT');
    expect(sql).not.toContain('UPDATE');
  });

  it('cria os indices que a consulta de capacidade usa', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryScheduling1785500000000().up(queryRunner);

    const indexes = queries.filter((q) => q.startsWith('CREATE INDEX'));
    expect(indexes).toHaveLength(2);
    expect(indexes.join('\n')).toContain('IDX_deliveries_fulfillment_mode');
    expect(indexes.join('\n')).toContain('IDX_deliveries_pickup_window_start');
  });

  it('o rollback derruba exatamente o que foi criado', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryScheduling1785500000000().down(queryRunner);

    expect(queries).toHaveLength(8);
    expect(queries.filter((q) => q.includes('DROP INDEX'))).toHaveLength(2);
    expect(queries.filter((q) => q.includes('DROP COLUMN'))).toHaveLength(6);
    expect(queries.at(-1)).toContain('"km_rate_cents"');
  });
});
