import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Courier } from '../database/entities/courier.entity';
import { Customer } from '../database/entities/customer.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { FinancialAccount } from '../database/entities/financial-account.entity';
import { LedgerEntry } from '../database/entities/ledger-entry.entity';
import { LedgerTransaction } from '../database/entities/ledger-transaction.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinancialAccount,
      LedgerTransaction,
      LedgerEntry,
      Courier,
      Customer,
      Delivery,
    ]),
    AuditModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
