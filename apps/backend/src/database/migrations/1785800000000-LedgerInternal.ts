import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `PAY-01` — ledger interno (plano de pagamentos §3, `DEC-05`).
 *
 * Cria as três tabelas do ledger imutável de partidas balanceadas:
 *
 * - `financial_accounts`: contas por participante × propósito (`AVAILABLE`/
 *   `RESERVED`) + conta da plataforma; o saldo é sempre projeção dos
 *   lançamentos, nunca coluna mantida à mão;
 * - `ledger_transactions`: operação de domínio com chave idempotente única e
 *   estado seguindo a máquina da reserva (`RESERVED → SETTLED | RELEASED`);
 * - `ledger_entries`: partidas com direção e valor inteiro positivo; a soma
 *   por transação é zero; `amount_cents > 0` é garantido por CHECK.
 *
 * Tabelas novas, sem tocar em nenhuma existente: `wallet_transactions` (crédito
 * MVP) permanece como registro histórico congelado — o extrato passa a ser
 * derivado do ledger. Sem reescrita de linhas, sem `synchronize=true`.
 */
export class LedgerInternal1785800000000 implements MigrationInterface {
  name = 'LedgerInternal1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_owner_type_enum" AS ENUM('CUSTOMER', 'COURIER', 'PLATFORM')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_account_purpose_enum" AS ENUM('AVAILABLE', 'RESERVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_account_status_enum" AS ENUM('ACTIVE', 'FROZEN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entry_direction_enum" AS ENUM('DEBIT', 'CREDIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_transaction_type_enum" AS ENUM('ADJUSTMENT', 'RESERVATION', 'RESERVATION_RELEASE', 'SETTLEMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_transaction_status_enum" AS ENUM('RESERVED', 'SETTLED', 'RELEASED', 'COMPLETED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "financial_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_type" "public"."ledger_owner_type_enum" NOT NULL, "owner_id" uuid NOT NULL, "purpose" "public"."ledger_account_purpose_enum" NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'BRL', "status" "public"."ledger_account_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_financial_accounts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_financial_accounts_owner" ON "financial_accounts" ("owner_type", "owner_id", "purpose")`,
    );

    await queryRunner.query(
      `CREATE TABLE "ledger_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."ledger_transaction_type_enum" NOT NULL, "reference_type" character varying(32) NOT NULL, "reference_id" character varying(64) NOT NULL, "idempotency_key" character varying(120) NOT NULL, "status" "public"."ledger_transaction_status_enum" NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ledger_transactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ledger_transactions_idempotency" ON "ledger_transactions" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_transactions_reference" ON "ledger_transactions" ("reference_type", "reference_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transaction_id" uuid NOT NULL, "account_id" uuid NOT NULL, "direction" "public"."ledger_entry_direction_enum" NOT NULL, "amount_cents" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ledger_entries" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_ledger_entries_transaction" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_ledger_entries_account" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ledger_entries_transaction_account" ON "ledger_entries" ("transaction_id", "account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_transaction" ON "ledger_entries" ("transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_account" ON "ledger_entries" ("account_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "CHK_ledger_entries_amount_positive" CHECK ("amount_cents" > 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "CHK_ledger_entries_amount_positive"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ledger_entries_account"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ledger_entries_transaction"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ledger_entries_transaction_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "FK_ledger_entries_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "FK_ledger_entries_transaction"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ledger_transactions_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ledger_transactions_idempotency"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_transactions"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_financial_accounts_owner"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "financial_accounts"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_transaction_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_transaction_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_entry_direction_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_account_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_account_purpose_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."ledger_owner_type_enum"`,
    );
  }
}
