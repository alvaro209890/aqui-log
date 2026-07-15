import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryStatus } from '../enums';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid', nullable: true })
  courierId!: string | null;

  @Column({ name: 'pickup_address' })
  pickupAddress!: string;

  @Column({ name: 'delivery_address' })
  deliveryAddress!: string;

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

  @Column({ name: 'price_cents', type: 'integer', default: 0 })
  priceCents!: number;

  @Column({ name: 'courier_fee_cents', type: 'integer', default: 0 })
  courierFeeCents!: number;

  @Column({ name: 'proof_url', nullable: true })
  proofUrl!: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
