import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adiciona o valor CUSTOMER ao enum de roles (B2C). */
export class AddCustomerRole1785000000001 implements MigrationInterface {
  name = 'AddCustomerRole1785000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'CUSTOMER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL não permite remover valores de enum facilmente; mantém no down.
    await queryRunner.query(`-- no-op: enum values cannot be dropped safely`);
  }
}
