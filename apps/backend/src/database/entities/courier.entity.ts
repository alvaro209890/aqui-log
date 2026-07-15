import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus, VehicleType } from '../enums';

@Entity('couriers')
export class Courier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ length: 14 })
  document!: string;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType })
  vehicleType!: VehicleType;

  @Column({
    name: 'vehicle_plate',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  vehiclePlate!: string | null;

  @Column({ name: 'document_urls', type: 'jsonb', default: [] })
  documentUrls!: string[];

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING })
  status!: AccountStatus;

  @Column({ default: false })
  available!: boolean;

  @Column({
    name: 'last_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLatitude!: number | null;

  @Column({
    name: 'last_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLongitude!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
