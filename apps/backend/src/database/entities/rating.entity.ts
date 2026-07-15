import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid' })
  courierId!: string;

  @Column({ type: 'smallint' })
  score!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
