import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2C: clientes pessoa física (customers), vínculo user->customer,
 * deliveries/ratings com dono opcional (company OU customer).
 */
export class B2CCustomers1785000000000 implements MigrationInterface {
  name = 'B2CCustomers1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "document" character varying(20) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "status" "users_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_user_id" ON "customers" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_document" ON "customers" ("document")`,
    );

    await queryRunner.query(`ALTER TABLE "users" ADD "customer_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_customer_id" ON "users" ("customer_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "deliveries" ALTER COLUMN "company_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "deliveries" ADD "customer_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_customer_id" ON "deliveries" ("customer_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "company_id" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "ratings" ADD "customer_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_ratings_customer_id" ON "ratings" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ratings_customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP COLUMN IF EXISTS "customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "company_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_deliveries_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ALTER COLUMN "company_id" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "customer_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
