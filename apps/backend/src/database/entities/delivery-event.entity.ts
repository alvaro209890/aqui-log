import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryStatus } from '../enums';

@Entity('delivery_events')
export class DeliveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'enum', enum: DeliveryStatus })
  status!: DeliveryStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'proof_url', type: 'varchar', nullable: true })
  proofUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
