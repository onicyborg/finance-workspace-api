import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { BudgetModule } from './budget/budget.module';
import { ReportsModule } from './reports/reports.module';
import { SavingGoalsModule } from './saving-goals/saving-goals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    MailModule,
    WorkspaceModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    BudgetModule,
    ReportsModule,
    SavingGoalsModule,
  ],
})
export class AppModule {}