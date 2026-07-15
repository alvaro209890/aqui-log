import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OfferStatus } from '../enums';

@Entity('delivery_offers')
@Index(['deliveryId', 'courierId'])
export class DeliveryOffer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid' })
  courierId!: string;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status!: OfferStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
