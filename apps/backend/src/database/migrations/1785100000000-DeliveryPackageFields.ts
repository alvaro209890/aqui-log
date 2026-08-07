import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2C-01: campos estruturados da encomenda.
 *
 * Todos os campos começam opcionais para preservar pedidos B2B e pedidos B2C
 * antigos, cujos metadados continuam legíveis pelo fallback em notes.
 */
export class DeliveryPackageFields1785100000000 implements MigrationInterface {
  name = 'DeliveryPackageFields1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "product_type" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "package_size" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "weight_kg" numeric(8,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "delivery_scope" character varying(24)`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD "product_photo_urls" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_product_type" ON "deliveries" ("product_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_package_size" ON "deliveries" ("package_size")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_package_size"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_product_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "product_photo_urls"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "delivery_scope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "weight_kg"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "package_size"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "product_type"`,
    );
  }
}
