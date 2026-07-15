import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Courier, Delivery]), AuthModule],
  providers: [TrackingGateway],
})
export class TrackingModule {}
