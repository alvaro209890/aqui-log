import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { DeliveryStatus, TransactionType } from '../database/enums';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
  ) {}

  async creditDelivery(delivery: Delivery) {
    if (!delivery.courierId || delivery.courierFeeCents <= 0) return null;
    const existing = await this.transactions.findOneBy({
      deliveryId: delivery.id,
      type: TransactionType.CREDIT,
    });
    if (existing) return existing;
    return this.transactions.save(
      this.transactions.create({
        courierId: delivery.courierId,
        deliveryId: delivery.id,
        type: TransactionType.CREDIT,
        amountCents: delivery.courierFeeCents,
        description: `Credito da entrega ${delivery.code}`,
      }),
    );
  }

  async statement(userId: string) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    const entries = await this.transactions.find({
      where: { courierId: courier.id },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const balanceCents = entries.reduce((total, entry) => {
      const direction = [
        TransactionType.DEBIT,
        TransactionType.PAYOUT,
      ].includes(entry.type)
        ? -1
        : 1;
      return total + entry.amountCents * direction;
    }, 0);
    return { balanceCents, entries };
  }

  async summary() {
    const query = this.deliveries
      .createQueryBuilder('delivery')
      .select('COALESCE(SUM(delivery.priceCents), 0)', 'grossCents')
      .addSelect(
        'COALESCE(SUM(delivery.courierFeeCents), 0)',
        'courierCostCents',
      )
      .addSelect('COUNT(*)', 'deliveredCount')
      .where('delivery.status = :status', { status: DeliveryStatus.DELIVERED });

    const result = await query.getRawOne<{
      grossCents: string;
      courierCostCents: string;
      deliveredCount: string;
    }>();
    const grossCents = Number(result?.grossCents ?? 0);
    const courierCostCents = Number(result?.courierCostCents ?? 0);
    return {
      grossCents,
      courierCostCents,
      marginCents: grossCents - courierCostCents,
      deliveredCount: Number(result?.deliveredCount ?? 0),
    };
  }
}
