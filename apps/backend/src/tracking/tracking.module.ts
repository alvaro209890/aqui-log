import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Courier, Delivery]), AuthModule],
  providers: [TrackingGateway],
  // DISP-02: o serviço de entregas emite avisos de demora e de término no
  // canal `delivery:{id}` pelo gateway.
  exports: [TrackingGateway],
})
export class TrackingModule {}
