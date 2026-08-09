import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `DISP-01` — rodadas de reoferta por anéis (plano §6.1/§6.2, `DEC-03`).
 *
 * Aditiva de propósito: todas as colunas nascem **nulas**, sem `NOT NULL` e sem
 * `DEFAULT`, e nenhuma linha existente é reescrita. Pedido criado antes desta
 * migration fica com `dispatch_round` e `dispatch_started_at` nulos, o que o
 * serviço lê como "ciclo ainda não começou" — ele volta a ser despachado
 * normalmente, começando do primeiro anel.
 *
 * O índice único parcial `(delivery_id, courier_id, dispatch_round)` é a trava
 * de idempotência exigida pelo plano §6.2: job repetido não consegue criar
 * duas ofertas para o mesmo par pedido/motoboy/rodada nem que o lock da
 * aplicação falhe. Ele é parcial porque as ofertas antigas têm
 * `dispatch_round` nulo e não devem colidir entre si.
 */
export class DispatchRounds1785600000000 implements MigrationInterface {
  name = 'DispatchRounds1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Estado do ciclo, no pedido.
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "dispatch_round" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "dispatch_started_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "dispatch_ended_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "dispatch_end_reason" character varying(16)`,
    );
    // Registro por rodada, na oferta (§6.2: raio, elegíveis, tentados).
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" ADD "dispatch_round" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" ADD "radius_km" numeric(6,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" ADD "eligible_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" ADD "attempted_count" integer`,
    );
    // Idempotência do job: um par pedido/motoboy/rodada só existe uma vez.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_delivery_offers_delivery_courier_round" ON "delivery_offers" ("delivery_id", "courier_id", "dispatch_round") WHERE "dispatch_round" IS NOT NULL`,
    );
    // O painel e o DISP-03 vão perguntar "quais pedidos pararam por quê".
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_dispatch_end_reason" ON "deliveries" ("dispatch_end_reason")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_dispatch_end_reason"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_delivery_offers_delivery_courier_round"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" DROP COLUMN IF EXISTS "attempted_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" DROP COLUMN IF EXISTS "eligible_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" DROP COLUMN IF EXISTS "radius_km"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_offers" DROP COLUMN IF EXISTS "dispatch_round"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "dispatch_end_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "dispatch_ended_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "dispatch_started_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "dispatch_round"`,
    );
  }
}
