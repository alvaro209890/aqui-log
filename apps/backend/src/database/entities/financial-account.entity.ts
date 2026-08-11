import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  LedgerAccountPurpose,
  LedgerAccountStatus,
  LedgerOwnerType,
} from '../enums';

/**
 * PAY-01 — conta do ledger (plano de pagamentos §3).
 *
 * Uma conta pertence a um participante (`ownerType`/`ownerId`) e tem um
 * propósito: saldo disponível ou saldo reservado. A conta da plataforma
 * (`PLATFORM`/`main`) existe em dois propósitos: `AVAILABLE` guarda a
 * contrapartida dos ajustes de teste (capital) e `RESERVED` acumula a receita
 * retida das liquidações. O saldo é sempre uma projeção dos lançamentos —
 * nunca um número mantido à mão.
 */
@Entity('financial_accounts')
@Index('IDX_financial_accounts_owner', ['ownerType', 'ownerId', 'purpose'], {
  unique: true,
})
export class FinancialAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_type', type: 'enum', enum: LedgerOwnerType })
  ownerType!: LedgerOwnerType;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'enum', enum: LedgerAccountPurpose })
  purpose!: LedgerAccountPurpose;

  @Column({ length: 3, default: 'BRL' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: LedgerAccountStatus,
    default: LedgerAccountStatus.ACTIVE,
  })
  status!: LedgerAccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
