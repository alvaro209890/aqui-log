import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerEntryDirection } from '../enums';

/**
 * PAY-01 — lançamento do ledger (plano de pagamentos §3).
 *
 * Partida única de uma transação: diz quanto (`amountCents`, sempre inteiro
 * positivo) e em que direção (`DEBIT`/`CREDIT`) uma conta foi movimentada.
 * A soma dos valores de todos os lançamentos de uma transação é zero.
 */
@Entity('ledger_entries')
@Index('IDX_ledger_entries_transaction', ['transactionId'])
@Index('IDX_ledger_entries_account', ['accountId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ type: 'enum', enum: LedgerEntryDirection })
  direction!: LedgerEntryDirection;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
