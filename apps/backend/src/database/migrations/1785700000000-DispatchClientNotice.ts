import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `DISP-02` — aviso ao cliente na busca por motoboy (plano §6.1.4/§6.1.5).
 *
 * Uma única coluna aditiva: o marco do "primeiro atraso significativo". O job
 * grava `dispatch_warning_at` no pedido quando a busca ativa já dura mais que
 * `dispatchFirstWarningMinutes` — e a coluna é a própria trava de idempotência:
 * o job roda a cada 10 s e não pode re-avisar o mesmo pedido.
 *
 * Nula em pedido anterior ao pacote (não avisado) e em todo pedido que aceitou
 * ou foi cancelado antes do marco. Sem `NOT NULL`, sem `DEFAULT`, sem reescrita
 * de linha existente: pedido legado sobrevive intocado.
 *
 * A proposta de aumento de valor com consentimento (§3.3, `DEC-03`) não cria
 * coluna: ela é computada pelo serviço a partir do preço congelado e do
 * percentual configurado, e a trilha fica em `delivery_events` + auditoria.
 */
export class DispatchClientNotice1785700000000 implements MigrationInterface {
  name = 'DispatchClientNotice1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "dispatch_warning_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_dispatch_warning" ON "deliveries" ("dispatch_warning_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_dispatch_warning"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "dispatch_warning_at"`,
    );
  }
}
