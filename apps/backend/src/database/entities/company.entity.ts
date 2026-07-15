import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus } from '../enums';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'legal_name', length: 180 })
  legalName!: string;

  @Column({ name: 'trade_name', length: 120 })
  tradeName!: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  document!: string;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING })
  status!: AccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
