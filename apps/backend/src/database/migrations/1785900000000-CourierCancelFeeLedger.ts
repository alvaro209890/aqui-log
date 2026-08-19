import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `COUR-02` — tipo de transação do ledger para a taxa de cancelamento do
 * prestador (`DEC-22`).
 *
 * Aditivo: um valor novo no enum `ledger_transaction_type_enum`. Sem tabela
 * nova, sem reescrita de linha. Pedidos e lançamentos anteriores ficam
 * intocados; a taxa só nasce quando o motoboy desiste de uma corrida aceita.
 */
export class CourierCancelFeeLedger1785900000000 implements MigrationInterface {
  name = 'CourierCancelFeeLedger1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_transaction_type_enum" ADD VALUE 'COURIER_CANCEL_FEE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres não tem DROP VALUE. Recria o tipo sem o valor novo. Falha se
    // já existir lançamento `COURIER_CANCEL_FEE` — o revert só vale antes
    // disso, que é o ensaio de rollback em banco descartável.
    await queryRunner.query(
      `ALTER TABLE "ledger_transactions" ALTER COLUMN "type" TYPE varchar`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."ledger_transaction_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_transaction_type_enum" AS ENUM('ADJUSTMENT', 'RESERVATION', 'RESERVATION_RELEASE', 'SETTLEMENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_transactions" ALTER COLUMN "type" TYPE "public"."ledger_transaction_type_enum" USING "type"::"public"."ledger_transaction_type_enum"`,
    );
  }
}
