import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OfferStatus } from '../enums';

@Entity('delivery_offers')
@Index(['deliveryId', 'courierId'])
export class DeliveryOffer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId!: string;

  @Index()
  @Column({ name: 'courier_id', type: 'uuid' })
  courierId!: string;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status!: OfferStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  // DISP-01 (plano §6.2): cada rodada registra o anel que a produziu. Nulo em
  // oferta anterior ao pacote — o índice único de idempotência é parcial
  // justamente para não colidir com esse legado.
  @Column({ name: 'dispatch_round', type: 'integer', nullable: true })
  dispatchRound!: number | null;

  /** Raio do anel usado nesta rodada, em km. */
  @Column({
    name: 'radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  radiusKm!: number | null;

  /** Candidatos não tentados que cabiam no anel desta rodada. */
  @Column({ name: 'eligible_count', type: 'integer', nullable: true })
  eligibleCount!: number | null;

  /** Quantos motoboys distintos já foram tentados neste pedido, contando este. */
  @Column({ name: 'attempted_count', type: 'integer', nullable: true })
  attemptedCount!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
