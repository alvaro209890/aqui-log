import { QueryRunner } from 'typeorm';
import { DeliveryPackageFields1785100000000 } from './migrations/1785100000000-DeliveryPackageFields';

describe('DeliveryPackageFields1785100000000', () => {
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

  it('adiciona somente campos opcionais e indices de consulta', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryPackageFields1785100000000().up(queryRunner);

    expect(queries).toHaveLength(7);
    expect(queries.join('\n')).toContain('ADD "product_type"');
    expect(queries.join('\n')).toContain('ADD "package_size"');
    expect(queries.join('\n')).toContain('ADD "weight_kg" numeric(8,3)');
    expect(queries.join('\n')).toContain('ADD "delivery_scope"');
    expect(queries.join('\n')).toContain(
      'ADD "product_photo_urls" jsonb NOT NULL DEFAULT',
    );
    expect(queries.join('\n')).not.toMatch(
      /ADD "(?:product_type|package_size|weight_kg|delivery_scope)"[^\n]*NOT NULL/,
    );
  });

  it('remove indices antes das colunas no rollback', async () => {
    const { queries, queryRunner } = createRunner();

    await new DeliveryPackageFields1785100000000().down(queryRunner);

    expect(queries).toHaveLength(7);
    expect(queries[0]).toContain('DROP INDEX');
    expect(queries[1]).toContain('DROP INDEX');
    expect(queries.slice(2).every((sql) => sql.includes('DROP COLUMN'))).toBe(
      true,
    );
    expect(queries.at(-1)).toContain('"product_type"');
  });
});
