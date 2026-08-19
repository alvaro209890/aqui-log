import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `B2C-04` / `DEC-04` — verificação de telefone do cliente.
 *
 * Colunas aditivas em `customers`: marco `phone_verified_at` e o desafio
 * corrente (hash, expiração, tentativas, cooldown, bloqueio). Sem NOT NULL
 * novo, sem reescrita: cliente legado fica não verificado e continua
 * usável até o gate `PHONE_VERIFY_REQUIRED`.
 */
export class CustomerPhoneVerification1786000000000 implements MigrationInterface {
  name = 'CustomerPhoneVerification1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_challenge_hash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_challenge_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_challenge_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_challenge_sent_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "phone_challenge_blocked_until" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_challenge_blocked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_challenge_sent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_challenge_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_challenge_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_challenge_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone_verified_at"`,
    );
  }
}
