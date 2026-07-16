import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryOffer } from '../database/entities/delivery-offer.entity';
import { Rating } from '../database/entities/rating.entity';
import { AccountStatus, DeliveryStatus, OfferStatus } from '../database/enums';
import {
  buildHourlySeries,
  buildStatusBreakdown,
  buildTrends,
  computePerformance,
  type DayCounts,
} from './dashboard-metrics';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    @InjectRepository(DeliveryOffer)
    private readonly offers: Repository<DeliveryOffer>,
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
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

  async trends() {
    const [today, yesterday] = await Promise.all([
      this.dayCounts(0),
      this.dayCounts(1),
    ]);
    return buildTrends(today, yesterday);
  }

  async deliveriesByHour(date?: string) {
    const day =
      date?.slice(0, 10) ??
      (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayNum}`;
      })();
    const rows = await this.deliveries
      .createQueryBuilder('delivery')
      .select('EXTRACT(HOUR FROM delivery.created_at)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where(
        date
          ? 'delivery.created_at::date = CAST(:day AS date)'
          : "delivery.created_at >= CURRENT_DATE AND delivery.created_at < CURRENT_DATE + INTERVAL '1 day'",
        date ? { day } : {},
      )
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany<{ hour: string; count: string }>();

    const hours: number[] = [];
    for (const row of rows) {
      const hour = Number(row.hour);
      const count = Number(row.count);
      for (let i = 0; i < count; i++) hours.push(hour);
    }
    return {
      date: day,
      series: buildHourlySeries(hours),
    };
  }

  async deliveriesByStatus() {
    const rows = await this.deliveries
      .createQueryBuilder('delivery')
      .select('delivery.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('delivery.status')
      .getRawMany<{ status: string; count: string }>();
    return { items: buildStatusBreakdown(rows) };
  }

  async performance() {
    const [totals, offerStats, avgRating] = await Promise.all([
      this.deliveries
        .createQueryBuilder('delivery')
        .select('COUNT(*)', 'total')
        .addSelect(
          `SUM(CASE WHEN delivery.status = :delivered THEN 1 ELSE 0 END)`,
          'delivered',
        )
        .addSelect(
          `SUM(CASE WHEN delivery.status = :canceled THEN 1 ELSE 0 END)`,
          'canceled',
        )
        .setParameters({
          delivered: DeliveryStatus.DELIVERED,
          canceled: DeliveryStatus.CANCELED,
        })
        .getRawOne<{ total: string; delivered: string; canceled: string }>(),
      this.offers
        .createQueryBuilder('offer')
        .select('COUNT(*)', 'totalOffers')
        .addSelect(
          `SUM(CASE WHEN offer.status = :accepted THEN 1 ELSE 0 END)`,
          'acceptedOffers',
        )
        .setParameters({ accepted: OfferStatus.ACCEPTED })
        .getRawOne<{ totalOffers: string; acceptedOffers: string }>(),
      this.ratings
        .createQueryBuilder('rating')
        .select('AVG(rating.score)', 'avg')
        .getRawOne<{ avg: string | null }>(),
    ]);

    return computePerformance({
      total: Number(totals?.total ?? 0),
      delivered: Number(totals?.delivered ?? 0),
      canceled: Number(totals?.canceled ?? 0),
      totalOffers: Number(offerStats?.totalOffers ?? 0),
      acceptedOffers: Number(offerStats?.acceptedOffers ?? 0),
      avgScore: avgRating?.avg == null ? null : Number(avgRating.avg),
    });
  }

  private async dayCounts(daysAgo: number): Promise<DayCounts> {
    const start = this.startOfDayOffset(daysAgo);
    const end = this.startOfDayOffset(daysAgo - 1);

    const [deliveries, inProgress, delivered, canceled, revenue, avgRow] =
      await Promise.all([
        this.deliveries
          .createQueryBuilder('delivery')
          .where('delivery.createdAt >= :start AND delivery.createdAt < :end', {
            start,
            end,
          })
          .getCount(),
        this.deliveries
          .createQueryBuilder('delivery')
          .where('delivery.createdAt >= :start AND delivery.createdAt < :end', {
            start,
            end,
          })
          .andWhere('delivery.status IN (:...statuses)', {
            statuses: [
              DeliveryStatus.ACCEPTED,
              DeliveryStatus.AT_PICKUP,
              DeliveryStatus.PICKED_UP,
              DeliveryStatus.IN_TRANSIT,
            ],
          })
          .getCount(),
        this.deliveries
          .createQueryBuilder('delivery')
          .where(
            'delivery.deliveredAt >= :start AND delivery.deliveredAt < :end',
            { start, end },
          )
          .andWhere('delivery.status = :status', {
            status: DeliveryStatus.DELIVERED,
          })
          .getCount(),
        this.deliveries
          .createQueryBuilder('delivery')
          .where(
            'delivery.canceledAt >= :start AND delivery.canceledAt < :end',
            { start, end },
          )
          .andWhere('delivery.status = :status', {
            status: DeliveryStatus.CANCELED,
          })
          .getCount(),
        this.deliveries
          .createQueryBuilder('delivery')
          .select('COALESCE(SUM(delivery.priceCents), 0)', 'total')
          .where(
            'delivery.deliveredAt >= :start AND delivery.deliveredAt < :end',
            { start, end },
          )
          .andWhere('delivery.status = :status', {
            status: DeliveryStatus.DELIVERED,
          })
          .getRawOne<{ total: string }>(),
        this.deliveries
          .createQueryBuilder('delivery')
          .select(
            'AVG(EXTRACT(EPOCH FROM (delivery.delivered_at - delivery.created_at)) / 60)',
            'avg',
          )
          .where(
            'delivery.deliveredAt >= :start AND delivery.deliveredAt < :end',
            { start, end },
          )
          .andWhere('delivery.deliveredAt IS NOT NULL')
          .getRawOne<{ avg: string | null }>(),
      ]);

    return {
      deliveries,
      inProgress,
      delivered,
      canceled,
      revenueCents: Number(revenue?.total ?? 0),
      avgMinutes:
        avgRow?.avg == null ? null : Math.round(Number(avgRow.avg) * 10) / 10,
    };
  }

  private startOfDayOffset(daysAgo: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
  }
}
