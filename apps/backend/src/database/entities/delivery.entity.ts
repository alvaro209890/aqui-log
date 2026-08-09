import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryStatus } from '../enums';
import type { PricingBreakdown } from '../../pricing/pricing.types';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ length: 24 })
  code!: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid', nullable: true })
  courierId!: string | null;

  @Column({ name: 'pickup_address' })
  pickupAddress!: string;

  @Column({ name: 'pickup_latitude', type: 'decimal', precision: 10, scale: 7 })
  pickupLatitude!: number;

  @Column({
    name: 'pickup_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  pickupLongitude!: number;

  @Column({ name: 'delivery_address' })
  deliveryAddress!: string;

  @Column({
    name: 'delivery_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  deliveryLatitude!: number;

  @Column({
    name: 'delivery_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  deliveryLongitude!: number;

  @Column({ name: 'recipient_name', length: 120 })
  recipientName!: string;

  @Column({ name: 'recipient_phone', length: 30 })
  recipientPhone!: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.REQUESTED,
  })
  status!: DeliveryStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Index()
  @Column({ name: 'product_type', type: 'varchar', length: 40, nullable: true })
  productType!: string | null;

  @Index()
  @Column({ name: 'package_size', type: 'varchar', length: 16, nullable: true })
  packageSize!: string | null;

  @Column({
    name: 'weight_kg',
    type: 'decimal',
    precision: 8,
    scale: 3,
    nullable: true,
  })
  weightKg!: number | null;

  @Column({
    name: 'delivery_scope',
    type: 'varchar',
    length: 24,
    nullable: true,
  })
  deliveryScope!: string | null;

  @Column({
    name: 'product_photo_urls',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  productPhotoUrls!: string[];

  @Column({ name: 'price_cents', type: 'integer', default: 0 })
  priceCents!: number;

  @Column({ name: 'courier_fee_cents', type: 'integer', default: 0 })
  courierFeeCents!: number;

  // B2C-02A: regra e valores congelados na criação. Pedido anterior ao preço
  // v2 fica com versão/breakdown nulos e continua legível.
  @Column({ name: 'pricing_version', type: 'integer', nullable: true })
  pricingVersion!: number | null;

  @Column({ name: 'pricing_breakdown', type: 'jsonb', nullable: true })
  pricingBreakdown!: PricingBreakdown | null;

  @Column({
    name: 'fulfillment_mode',
    type: 'varchar',
    length: 16,
    default: 'IMMEDIATE',
  })
  fulfillmentMode!: string;

  // PICK-01 / DEC-24: código de recolhimento. Nulo em pedido legado e em
  // pedido ainda não aceito; a partir do aceite, é exigido na coleta.
  @Column({ name: 'pickup_code', type: 'varchar', length: 8, nullable: true })
  pickupCode!: string | null;

  @Column({ name: 'pickup_code_attempts', type: 'integer', default: 0 })
  pickupCodeAttempts!: number;

  @Column({
    name: 'pickup_code_blocked_until',
    type: 'timestamptz',
    nullable: true,
  })
  pickupCodeBlockedUntil!: Date | null;

  @Column({
    name: 'pickup_code_verified_at',
    type: 'timestamptz',
    nullable: true,
  })
  pickupCodeVerifiedAt!: Date | null;

  // Fallback de código perdido/ilegível: só admin/suporte, com motivo (DEC-24).
  @Column({ name: 'pickup_code_override_by_id', type: 'uuid', nullable: true })
  pickupCodeOverrideById!: string | null;

  @Column({ name: 'pickup_code_override_reason', type: 'text', nullable: true })
  pickupCodeOverrideReason!: string | null;

  @Column({ name: 'collection_proof_url', type: 'varchar', nullable: true })
  collectionProofUrl!: string | null;

  @Column({ name: 'delivery_proof_url', type: 'varchar', nullable: true })
  deliveryProofUrl!: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
