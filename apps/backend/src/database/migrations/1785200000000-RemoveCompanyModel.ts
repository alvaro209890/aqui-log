import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RemoveCompanyModel (2026-08-07)
 * ---------------------------------
 * O modelo B2B/empresa (companies, roles COMPANY_OWNER/COMPANY_USER e
 * colunas company_id) foi removido do produto. Restam apenas 3 perfis:
 * PRESTADOR (COURIER), CLIENTE (CUSTOMER) e ADMIN (SUPER_ADMIN/ADMIN/SUPPORT).
 *
 * Esta migration dropa a tabela companies, o tipo de enum dela e as colunas
 * company_id de users/deliveries/ratings. Nao altera os valores COMPANY_* do
 * enum users_role_enum (valores obsoletos nao sao removidos do tipo para
 * nao quebrar registros historicos; apenas nao sao mais usados).
 */
export class RemoveCompanyModel1785200000000 implements MigrationInterface {
  name = 'RemoveCompanyModel1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "companies_status_enum"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_b34ed58a2acbcb7254dad0b877"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN "company_id"`,
    );

    await queryRunner.query(`ALTER TABLE "ratings" DROP COLUMN "company_id"`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "company_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "company_id" uuid`);
    await queryRunner.query(`ALTER TABLE "ratings" ADD "company_id" uuid`);
    await queryRunner.query(`ALTER TABLE "deliveries" ADD "company_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_b34ed58a2acbcb7254dad0b877" ON "deliveries"  ("company_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "companies_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "legal_name" character varying(180) NOT NULL, "trade_name" character varying(120) NOT NULL, "document" character varying(20) NOT NULL, "status" "public"."companies_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_13496c970093729e7ab04eb7da" ON "companies"  ("document") `,
    );
  }
}
