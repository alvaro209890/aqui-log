import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { AccountStatus, DeliveryStatus } from '../database/enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
  ) {}

  async summary() {
    const [
      deliveriesToday,
      activeCompanies,
      availableCouriers,
      inProgress,
      revenue,
    ] = await Promise.all([
      this.deliveries
        .createQueryBuilder('delivery')
        .where('delivery.createdAt >= CURRENT_DATE')
        .getCount(),
      this.companies.countBy({ status: AccountStatus.ACTIVE }),
      this.couriers.countBy({ status: AccountStatus.ACTIVE, available: true }),
      this.deliveries.countBy({ status: DeliveryStatus.IN_TRANSIT }),
      this.deliveries
        .createQueryBuilder('delivery')
        .select('COALESCE(SUM(delivery.priceCents), 0)', 'total')
        .where('delivery.status = :status', {
          status: DeliveryStatus.DELIVERED,
        })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      deliveriesToday,
      activeCompanies,
      availableCouriers,
      inProgress,
      revenueCents: Number(revenue?.total ?? 0),
    };
  }
}
