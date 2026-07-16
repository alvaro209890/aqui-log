import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { CouriersModule } from './couriers/couriers.module';
import { Company } from './database/entities/company.entity';
import { Courier } from './database/entities/courier.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { DeliveryEvent } from './database/entities/delivery-event.entity';
import { DeliveryOffer } from './database/entities/delivery-offer.entity';
import { Delivery } from './database/entities/delivery.entity';
import { Notification } from './database/entities/notification.entity';
import { PasswordResetToken } from './database/entities/password-reset-token.entity';
import { Rating } from './database/entities/rating.entity';
import { RefreshToken } from './database/entities/refresh-token.entity';
import { User } from './database/entities/user.entity';
import { WalletTransaction } from './database/entities/wallet-transaction.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { FinanceModule } from './finance/finance.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PricingModule } from './pricing/pricing.module';
import { RedisModule } from './redis/redis.module';
import { TrackingModule } from './tracking/tracking.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: Number(config.get('DATABASE_PORT', 5432)),
        username: config.get('DATABASE_USER', 'aqui_log'),
        password: config.get('DATABASE_PASSWORD', 'aqui_log_dev'),
        database: config.get('DATABASE_NAME', 'aqui_log'),
        entities: [
          User,
          Company,
          Courier,
          Delivery,
          DeliveryOffer,
          DeliveryEvent,
          Notification,
          AuditLog,
          WalletTransaction,
          Rating,
          RefreshToken,
          PasswordResetToken,
        ],
        synchronize: config.get('DATABASE_SYNC', 'false') === 'true',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    RedisModule,
    PricingModule,
    MailModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    FinanceModule,
    CompaniesModule,
    CouriersModule,
    DeliveriesModule,
    DashboardModule,
    TrackingModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
