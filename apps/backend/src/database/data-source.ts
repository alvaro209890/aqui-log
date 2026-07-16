import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Company } from './entities/company.entity';
import { Courier } from './entities/courier.entity';
import { DeliveryEvent } from './entities/delivery-event.entity';
import { DeliveryOffer } from './entities/delivery-offer.entity';
import { Delivery } from './entities/delivery.entity';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './entities/notification.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Rating } from './entities/rating.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';

config({ path: '../../.env' });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'aqui_log',
  password: process.env.DATABASE_PASSWORD ?? 'aqui_log_dev',
  database: process.env.DATABASE_NAME ?? 'aqui_log',
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
    DeviceToken,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
