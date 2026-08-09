import { QueryRunner } from 'typeorm';
import { DispatchRounds1785600000000 } from './migrations/1785600000000-DispatchRounds';

describe('DispatchRounds1785600000000', () => {
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

  it('e aditiva: rodadas e telemetria entram opcionais', async () => {
    const { queries, queryRunner } = createRunner();

    await new DispatchRounds1785600000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('"deliveries" ADD "dispatch_round" integer');
    expect(sql).toContain(
      '"deliveries" ADD "dispatch_started_at" TIMESTAMP WITH TIME ZONE',
    );
    expect(sql).toContain(
      '"deliveries" ADD "dispatch_ended_at" TIMESTAMP WITH TIME ZONE',
    );
    expect(sql).toContain(
      '"deliveries" ADD "dispatch_end_reason" character varying(16)',
    );
    expect(sql).toContain('"delivery_offers" ADD "dispatch_round" integer');
    expect(sql).toContain('"delivery_offers" ADD "radius_km" numeric(6,2)');
    expect(sql).toContain('"delivery_offers" ADD "eligible_count" integer');
    expect(sql).toContain('"delivery_offers" ADD "attempted_count" integer');
    // Pedido e oferta antigos sobrevivem sem reescrita: nada de NOT NULL,
    // DEFAULT ou UPDATE nas colunas. (O `IS NOT NULL` do índice parcial é
    // predicado de WHERE, não restrição de coluna — por isso só as ALTER TABLE
    // entram nesta verificação.)
    const alters = queries.filter((q) => q.startsWith('ALTER TABLE'));
    expect(alters).toHaveLength(8);
    expect(alters.join('\n')).not.toContain('NOT NULL');
    expect(alters.join('\n')).not.toContain('DEFAULT');
    expect(sql).not.toContain('UPDATE');
  });

  it('cria a trava de idempotencia do par pedido/motoboy/rodada', async () => {
    const { queries, queryRunner } = createRunner();

    await new DispatchRounds1785600000000().up(queryRunner);

    const unique = queries.filter((q) => q.startsWith('CREATE UNIQUE INDEX'));
    expect(unique).toHaveLength(1);
    expect(unique[0]).toContain('UQ_delivery_offers_delivery_courier_round');
    expect(unique[0]).toContain(
      '("delivery_id", "courier_id", "dispatch_round")',
    );
    // Parcial: oferta anterior ao pacote tem rodada nula e nao pode colidir.
    expect(unique[0]).toContain('WHERE "dispatch_round" IS NOT NULL');
  });

  it('o rollback derruba exatamente o que foi criado', async () => {
    const { queries, queryRunner } = createRunner();

    await new DispatchRounds1785600000000().down(queryRunner);

    expect(queries.filter((q) => q.includes('DROP INDEX'))).toHaveLength(2);
    expect(queries.filter((q) => q.includes('DROP COLUMN'))).toHaveLength(8);
    expect(queries.at(-1)).toContain('"dispatch_round"');
  });
});
