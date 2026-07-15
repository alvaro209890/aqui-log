import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeTimestamps1784083392800 implements MigrationInterface {
  name = 'NormalizeTimestamps1784083392800';

  private readonly columns: Array<[string, string]> = [
    ['audit_logs', 'created_at'],
    ['companies', 'created_at'],
    ['companies', 'updated_at'],
    ['couriers', 'created_at'],
    ['couriers', 'updated_at'],
    ['delivery_events', 'created_at'],
    ['delivery_offers', 'created_at'],
    ['deliveries', 'created_at'],
    ['deliveries', 'updated_at'],
    ['notifications', 'created_at'],
    ['ratings', 'created_at'],
    ['users', 'created_at'],
    ['users', 'updated_at'],
    ['wallet_transactions', 'created_at'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of this.columns) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of [...this.columns].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITHOUT TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
