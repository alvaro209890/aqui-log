import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2C-02A — congela a precificação no pedido.
 *
 * `pricing_version` + `pricing_breakdown` guardam a regra e os valores usados
 * na criação, para que mudança de settings não altere pedido já criado
 * (`DEC-19`). Aditiva: pedido antigo fica com versão nula e breakdown nulo,
 * e continua legível.
 */
export class DeliveryPricingV2Fields1785300000000 implements MigrationInterface {
  name = 'DeliveryPricingV2Fields1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pricing_version" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "pricing_breakdown" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "fulfillment_mode" character varying(16) NOT NULL DEFAULT 'IMMEDIATE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "fulfillment_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pricing_breakdown"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "pricing_version"`,
    );
  }
}
