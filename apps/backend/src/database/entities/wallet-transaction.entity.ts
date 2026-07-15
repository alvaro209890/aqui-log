import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionType } from '../enums';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid' })
  courierId!: string;

  @Index()
  @Column({ name: 'delivery_id', type: 'uuid', nullable: true })
  deliveryId!: string | null;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ length: 180 })
  description!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
