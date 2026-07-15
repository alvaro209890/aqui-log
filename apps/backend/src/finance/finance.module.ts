import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WalletTransaction, Courier, Delivery])],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
