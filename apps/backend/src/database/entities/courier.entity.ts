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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
