import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784082573425 implements MigrationInterface {
  name = 'InitialSchema1784082573425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" character varying(100) NOT NULL, "resource_type" character varying(80) NOT NULL, "resource_id" character varying(80), "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "audit_logs"  ("actor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."companies_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "legal_name" character varying(180) NOT NULL, "trade_name" character varying(120) NOT NULL, "document" character varying(20) NOT NULL, "status" "public"."companies_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_13496c970093729e7ab04eb7da" ON "companies"  ("document") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."couriers_vehicle_type_enum" AS ENUM('MOTORCYCLE', 'CAR', 'BICYCLE', 'VAN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."couriers_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "couriers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "document" character varying(14) NOT NULL, "vehicle_type" "public"."couriers_vehicle_type_enum" NOT NULL, "vehicle_plate" character varying(12), "document_urls" jsonb NOT NULL DEFAULT '[]', "status" "public"."couriers_status_enum" NOT NULL DEFAULT 'PENDING', "available" boolean NOT NULL DEFAULT false, "last_latitude" numeric(10,7), "last_longitude" numeric(10,7), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_141c3ed6f70beb9ddf4ab4a0e86" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e3f889b75b7c9f89ab5a1242f8" ON "couriers"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_990be824bb22edaba363d60485" ON "couriers"  ("document") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_events_status_enum" AS ENUM('REQUESTED', 'OFFERED', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "delivery_id" uuid NOT NULL, "actor_id" uuid, "status" "public"."delivery_events_status_enum" NOT NULL, "note" text, "proof_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19b3537a3e016d72733fa56f7a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9cf33d8c908fabd73d16247a0" ON "delivery_events"  ("delivery_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_offers_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "delivery_id" uuid NOT NULL, "courier_id" uuid NOT NULL, "status" "public"."delivery_offers_status_enum" NOT NULL DEFAULT 'PENDING', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "responded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_335377b132db63eaf2c373d04ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f14e3a690f02e04124d68324e" ON "delivery_offers"  ("delivery_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c55556c982d1c49e5276b7528b" ON "delivery_offers"  ("courier_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_02d3298ad32fdb51adcba72e7a" ON "delivery_offers"  ("delivery_id", "courier_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."deliveries_status_enum" AS ENUM('REQUESTED', 'OFFERED', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(24) NOT NULL, "company_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, "courier_id" uuid, "pickup_address" character varying NOT NULL, "pickup_latitude" numeric(10,7) NOT NULL, "pickup_longitude" numeric(10,7) NOT NULL, "delivery_address" character varying NOT NULL, "delivery_latitude" numeric(10,7) NOT NULL, "delivery_longitude" numeric(10,7) NOT NULL, "recipient_name" character varying(120) NOT NULL, "recipient_phone" character varying(30) NOT NULL, "status" "public"."deliveries_status_enum" NOT NULL DEFAULT 'REQUESTED', "notes" text, "price_cents" integer NOT NULL DEFAULT '0', "courier_fee_cents" integer NOT NULL DEFAULT '0', "collection_proof_url" character varying, "delivery_proof_url" character varying, "scheduled_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "canceled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a6ef225c5c5f0974e503bfb731f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0b7a81e9e1c5097bf06fda7db7" ON "deliveries"  ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b34ed58a2acbcb7254dad0b877" ON "deliveries"  ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f493740b001c8c700ded5bc212" ON "deliveries"  ("courier_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('DELIVERY', 'ACCOUNT', 'FINANCE', 'SYSTEM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(140) NOT NULL, "body" text NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "delivery_id" uuid NOT NULL, "company_id" uuid NOT NULL, "courier_id" uuid NOT NULL, "score" smallint NOT NULL, "comment" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_71b1a8664ccfae69f3752ddcb6" ON "ratings"  ("delivery_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_90fd120282870c455ac8975372" ON "ratings"  ("courier_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('SUPER_ADMIN', 'ADMIN', 'COMPANY_OWNER', 'COMPANY_USER', 'COURIER', 'SUPPORT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(180) NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'PENDING', "company_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallet_transactions_type_enum" AS ENUM('CREDIT', 'DEBIT', 'PAYOUT', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "wallet_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "courier_id" uuid NOT NULL, "delivery_id" uuid, "type" "public"."wallet_transactions_type_enum" NOT NULL, "amount_cents" integer NOT NULL, "description" character varying(180) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5120f131bde2cda940ec1a621db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cea20957da0d63f0dd5c616504" ON "wallet_transactions"  ("courier_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56c0da7145cf9456fa3b70276e" ON "wallet_transactions"  ("delivery_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_56c0da7145cf9456fa3b70276e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cea20957da0d63f0dd5c616504"`,
    );
    await queryRunner.query(`DROP TABLE "wallet_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."wallet_transactions_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90fd120282870c455ac8975372"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_71b1a8664ccfae69f3752ddcb6"`,
    );
    await queryRunner.query(`DROP TABLE "ratings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f493740b001c8c700ded5bc212"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b34ed58a2acbcb7254dad0b877"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b7a81e9e1c5097bf06fda7db7"`,
    );
    await queryRunner.query(`DROP TABLE "deliveries"`);
    await queryRunner.query(`DROP TYPE "public"."deliveries_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_02d3298ad32fdb51adcba72e7a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c55556c982d1c49e5276b7528b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f14e3a690f02e04124d68324e"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_offers"`);
    await queryRunner.query(`DROP TYPE "public"."delivery_offers_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d9cf33d8c908fabd73d16247a0"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_events"`);
    await queryRunner.query(`DROP TYPE "public"."delivery_events_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_990be824bb22edaba363d60485"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3f889b75b7c9f89ab5a1242f8"`,
    );
    await queryRunner.query(`DROP TABLE "couriers"`);
    await queryRunner.query(`DROP TYPE "public"."couriers_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."couriers_vehicle_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13496c970093729e7ab04eb7da"`,
    );
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TYPE "public"."companies_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_177183f29f438c488b5e8510cd"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
