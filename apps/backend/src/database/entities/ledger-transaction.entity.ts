import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerTransactionStatus, LedgerTransactionType } from '../enums';

/**
 * PAY-01 — transação lógica do ledger (plano de pagamentos §3).
 *
 * Cada operação de domínio (ajuste, reserva, liberação, liquidação) vira uma
 * transação com partidas balanceadas e uma chave idempotente única. Repetir a
 * mesma operação retorna o resultado anterior sem gerar lançamentos novos.
 *
 * `referenceType`/`referenceId` apontam o objeto de negócio (ex.: a entrega);
 * `status` segue a máquina da reserva (`RESERVED → SETTLED | RELEASED`).
 * O ledger não é editado nem apagado: correção é sempre uma transação reversa.
 */
@Entity('ledger_transactions')
@Index('IDX_ledger_transactions_reference', ['referenceType', 'referenceId'])
export class LedgerTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: LedgerTransactionType })
  type!: LedgerTransactionType;

  @Column({ name: 'reference_type', length: 32 })
  referenceType!: string;

  @Column({ name: 'reference_id', length: 64 })
  referenceId!: string;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', length: 120 })
  idempotencyKey!: string;

  @Column({ type: 'enum', enum: LedgerTransactionStatus })
  status!: LedgerTransactionStatus;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
