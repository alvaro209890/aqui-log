import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Courier } from '../database/entities/courier.entity';
import { DeliveryEvent } from '../database/entities/delivery-event.entity';
import { DeliveryOffer } from '../database/entities/delivery-offer.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { Rating } from '../database/entities/rating.entity';
import { StorageModule } from '../storage/storage.module';
import { TrackingModule } from '../tracking/tracking.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryJobsService } from './delivery-jobs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Delivery,
      Courier,
      DeliveryOffer,
      DeliveryEvent,
      Rating,
    ]),
    StorageModule,
    // DISP-02: o serviço emite avisos de demora/término no canal `delivery:{id}`.
    TrackingModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryJobsService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
