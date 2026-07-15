import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Index()
  @Column({ length: 100 })
  action!: string;

  @Column({ name: 'resource_type', length: 80 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 80, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
