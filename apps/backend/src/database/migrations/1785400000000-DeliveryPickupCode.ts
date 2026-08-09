import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PICK-01 — código de recolhimento na coleta (`DEC-24` + `FLOW-DEC-03`).
 *
 * Aditiva de propósito: pedido antigo fica com `pickup_code` nulo e continua
 * avançando `AT_PICKUP → PICKED_UP` só com a foto de coleta (comportamento
 * atual). A obrigatoriedade do código vale para o que for aceito a partir de
 * agora, que é quando o código passa a ser gerado.
 *
 * As colunas de tentativa e bloqueio ficam no banco (e não só no Redis) porque
 * o bloqueio de `FLOW-DEC-03` é uma decisão de negócio auditável: precisa
 * sobreviver a restart e aparecer no dossiê do pedido.
 */
export class DeliveryPickupCode1785400000000 implements MigrationInterface {
  name = 'DeliveryPickupCode1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code" character varying(8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code_blocked_until" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code_override_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pickup_code_override_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code_override_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code_override_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code_verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code_blocked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pickup_code"`,
    );
  }
}
