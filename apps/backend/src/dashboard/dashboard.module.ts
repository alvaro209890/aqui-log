import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryOffer } from '../database/entities/delivery-offer.entity';
import { Rating } from '../database/entities/rating.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, Courier, DeliveryOffer, Rating]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
