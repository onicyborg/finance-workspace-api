import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Account } from '@prisma/client';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      // 🔎 1. Get from account
      const fromAccount = await tx.account.findFirst({
        where: {
          id: dto.accountId,
          workspaceId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!fromAccount) {
        throw new NotFoundException('Account not found or inactive');
      }

      let toAccount: Account | null = null;

      // 🔁 TRANSFER validation
      if (dto.type === 'TRANSFER') {
        if (!dto.toAccountId) {
          throw new BadRequestException('toAccountId is required for transfer');
        }

        if (dto.toAccountId === dto.accountId) {
          throw new BadRequestException('Cannot transfer to the same account');
        }

        toAccount = await tx.account.findFirst({
          where: {
            id: dto.toAccountId,
            workspaceId,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!toAccount) {
          throw new NotFoundException(
            'Destination account not found or inactive',
          );
        }

        if (Number(fromAccount.balance) < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      // 💰 2. Balance Validation

      if (dto.type === 'EXPENSE' || dto.type === 'TRANSFER') {
        if (Number(fromAccount.balance) < dto.amount) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      if (dto.type === 'TRANSFER' && dto.categoryId) {
        throw new BadRequestException(
          'Transfer transaction must not have category',
        );
      }

      if (dto.type !== 'TRANSFER') {
        if (!dto.categoryId) {
          throw new BadRequestException('Category is required');
        }

        const category = await tx.category.findFirst({
          where: {
            id: dto.categoryId,
            workspaceId,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!category) {
          throw new NotFoundException('Category not found');
        }

        if (category.type !== dto.type) {
          throw new BadRequestException(
            'Category type does not match transaction type',
          );
        }
      }

      // 🔄 3. Apply Balance Mutation

      if (dto.type === 'INCOME') {
        await tx.account.update({
          where: { id: fromAccount.id },
          data: {
            balance: {
              increment: dto.amount,
            },
          },
        });
      }

      if (dto.type === 'EXPENSE') {
        await tx.account.update({
          where: { id: fromAccount.id },
          data: {
            balance: {
              decrement: dto.amount,
            },
          },
        });
      }

      if (dto.type === 'TRANSFER') {
        await tx.account.update({
          where: { id: fromAccount.id },
          data: {
            balance: {
              decrement: dto.amount,
            },
          },
        });

        await tx.account.update({
          where: { id: toAccount?.id },
          data: {
            balance: { increment: dto.amount },
          },
        });
      }

      // 📝 4. Create Transaction Record

      return tx.transaction.create({
        data: {
          workspaceId,
          type: dto.type,
          accountId: dto.accountId,
          toAccountId: dto.type === 'TRANSFER' ? dto.toAccountId : null,
          categoryId: dto.categoryId ?? null,
          amount: dto.amount,
          description: dto.description ?? null,
          transactionDate: dto.transactionDate
            ? new Date(dto.transactionDate)
            : new Date(),
        },
      });
    });
  }

  async findAll(workspaceId: string, query: TransactionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      workspaceId,
      deletedAt: null,
    };

    // 🔎 Filter: type
    if (query.type) {
      where.type = query.type;
    }

    // 🔎 Filter: category
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // 🔎 Filter: account (include transfer both sides)
    if (query.accountId) {
      where.OR = [
        { accountId: query.accountId },
        { toAccountId: query.accountId },
      ];
    }

    // 🔎 Filter: date range
    if (query.startDate || query.endDate) {
      where.transactionDate = {};

      if (query.startDate) {
        where.transactionDate.gte = new Date(query.startDate);
      }

      if (query.endDate) {
        where.transactionDate.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: {
          account: true,
          toAccount: true,
          category: true,
        },
        orderBy: {
          transactionDate: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}
