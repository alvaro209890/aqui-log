import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus } from '../enums';

/** Cliente pessoa física (B2C) — cadastro simples, auto-aprovado. */
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  document!: string;

  @Column({ length: 30 })
  phone!: string;

  // B2C-04 / DEC-04: nulo = ainda não confirmou o telefone.
  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt!: Date | null;

  @Column({
    name: 'phone_challenge_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  phoneChallengeHash!: string | null;

  @Column({
    name: 'phone_challenge_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  phoneChallengeExpiresAt!: Date | null;

  @Column({ name: 'phone_challenge_attempts', type: 'integer', default: 0 })
  phoneChallengeAttempts!: number;

  @Column({
    name: 'phone_challenge_sent_at',
    type: 'timestamptz',
    nullable: true,
  })
  phoneChallengeSentAt!: Date | null;

  @Column({
    name: 'phone_challenge_blocked_until',
    type: 'timestamptz',
    nullable: true,
  })
  phoneChallengeBlockedUntil!: Date | null;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
