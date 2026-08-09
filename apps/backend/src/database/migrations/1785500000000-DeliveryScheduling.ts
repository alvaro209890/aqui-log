import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SCHED-01 / B2C-06 — janelas do modo agendado e valores congelados.
 *
 * Aditiva de propósito. `fulfillment_mode` já existe desde `B2C-02A` com
 * default `IMMEDIATE`, então pedido antigo continua legível e continua sendo
 * tratado como imediato: as janelas nascem nulas e nada é reescrito.
 *
 * `km_rate_cents` duplica um valor que já está dentro de `pricing_breakdown`.
 * A duplicação é deliberada: o `DEC-19` exige provar qual tarifa foi cobrada, e
 * fazer isso abrindo JSON em consulta de auditoria é caro e frágil.
 *
 * `courier_cancel_fee_cents` é a taxa congelada no aceite (`DEC-20`). A
 * COBRANÇA continua fora deste pacote (`COUR-02` / `PAY-01`) — aqui só se
 * guarda o valor combinado.
 */
export class DeliveryScheduling1785500000000 implements MigrationInterface {
  name = 'DeliveryScheduling1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "km_rate_cents" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_window_start" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_window_end" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "delivery_window_start" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "delivery_window_end" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "courier_cancel_fee_cents" integer`,
    );
    // A consulta de capacidade (plano §5.1) filtra por modo + janela a cada
    // despacho; sem índice ela varre a tabela inteira de entregas.
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_fulfillment_mode" ON "deliveries" ("fulfillment_mode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_pickup_window_start" ON "deliveries" ("pickup_window_start")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_pickup_window_start"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_fulfillment_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "courier_cancel_fee_cents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "delivery_window_end"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "delivery_window_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "pickup_window_end"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "pickup_window_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "km_rate_cents"`,
    );
  }
}
