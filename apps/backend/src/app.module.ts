import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { CouriersModule } from './couriers/couriers.module';
import { Company } from './database/entities/company.entity';
import { Courier } from './database/entities/courier.entity';
import { Delivery } from './database/entities/delivery.entity';
import { User } from './database/entities/user.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: Number(config.get('DATABASE_PORT', 5432)),
        username: config.get('DATABASE_USER', 'aqui_log'),
        password: config.get('DATABASE_PASSWORD', 'aqui_log_dev'),
        database: config.get('DATABASE_NAME', 'aqui_log'),
        entities: [User, Company, Courier, Delivery],
        synchronize: config.get('DATABASE_SYNC', 'false') === 'true',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    CompaniesModule,
    CouriersModule,
    DeliveriesModule,
    DashboardModule,
    TrackingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
