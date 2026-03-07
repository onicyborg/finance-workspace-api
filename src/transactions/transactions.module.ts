import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { StorageModule } from '../storage/storage.module';
import { SavingGoalsModule } from '../saving-goals/saving-goals.module';

@Module({
  imports: [StorageModule, SavingGoalsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
