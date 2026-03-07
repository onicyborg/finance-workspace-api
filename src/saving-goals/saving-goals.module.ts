import { Module } from '@nestjs/common';
import { SavingGoalsController } from './saving-goals.controller';
import { SavingGoalsService } from './saving-goals.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SavingGoalsController],
  providers: [SavingGoalsService],
  exports: [SavingGoalsService],
})
export class SavingGoalsModule {}