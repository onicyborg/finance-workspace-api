import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Account } from '@prisma/client';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { StorageService } from 'src/storage/storage.service';
import sharp from 'sharp';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async create(workspaceId: string, dto: CreateTransactionDto, userId: string) {
    if (!userId) {
      throw new BadRequestException('User id is required');
    }
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
          createdById: userId,
          updatedById: userId,
        },
      });
    });
  }

  async metaFilter(workspaceId: string) {
    const types = ['INCOME', 'EXPENSE', 'TRANSFER'];

    const categories = await this.prisma.category.findMany({
      where: { workspaceId },
      select: { id: true, name: true, type: true },
    });

    const accounts = await this.prisma.account.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    return { types, categories, accounts };
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
        // Set start date to beginning of day (00:00:00)
        const startDate = new Date(query.startDate);
        startDate.setHours(0, 0, 0, 0);
        where.transactionDate.gte = startDate;
      }

      if (query.endDate) {
        // Set end date to end of day (23:59:59.999)
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.transactionDate.lte = endDate;
      }
    } else {
      // Default: show transactions from today only
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      where.transactionDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
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

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateTransactionDto,
    userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User id is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id, workspaceId, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('Transaction not found');
      }

      // ⏳ 5 minute rule
      const diff = Date.now() - existing.createdAt.getTime();
      if (diff > 5 * 60 * 1000) {
        throw new BadRequestException(
          'Transaction can only be updated within 5 minutes',
        );
      }

      // 🔁 1️⃣ Reverse Old Mutation

      await this.reverseMutation(tx, existing);

      // 🔄 2️⃣ Merge new data
      const newData = {
        type: dto.type ?? existing.type,
        accountId: dto.accountId ?? existing.accountId,
        toAccountId:
          dto.type === 'TRANSFER'
            ? (dto.toAccountId ?? existing.toAccountId)
            : null,
        amount: dto.amount ?? Number(existing.amount),
        categoryId: dto.categoryId ?? existing.categoryId,
        description: dto.description ?? existing.description,
        transactionDate: dto.transactionDate
          ? new Date(dto.transactionDate)
          : existing.transactionDate,
      };

      // 🔎 3️⃣ Validate new mutation
      await this.validateAndApplyMutation(tx, workspaceId, newData);

      // 📝 4️⃣ Update record
      return tx.transaction.update({
        where: { id },
        data: {
          ...newData,
          updatedById: userId,
        },
      });
    });
  }

  async delete(workspaceId: string, id: string, userId: string) {
    if (!userId) {
      throw new BadRequestException('User id is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          id,
          workspaceId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException('Transaction not found');
      }

      // ⏳ 5 minute rule
      const diff = Date.now() - existing.createdAt.getTime();

      if (diff > 5 * 60 * 1000) {
        throw new BadRequestException(
          'Transaction can only be deleted within 5 minutes of creation',
        );
      }

      // 🔁 Reverse mutation
      await this.reverseMutation(tx, existing);

      // 🗑 Soft delete
      return tx.transaction.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedById: userId,
        },
      });
    });
  }

  private async reverseMutation(tx, trx) {
    if (trx.type === 'INCOME') {
      await tx.account.update({
        where: { id: trx.accountId },
        data: { balance: { decrement: Number(trx.amount) } },
      });
    }

    if (trx.type === 'EXPENSE') {
      await tx.account.update({
        where: { id: trx.accountId },
        data: { balance: { increment: Number(trx.amount) } },
      });
    }

    if (trx.type === 'TRANSFER') {
      await tx.account.update({
        where: { id: trx.accountId },
        data: { balance: { increment: Number(trx.amount) } },
      });

      await tx.account.update({
        where: { id: trx.toAccountId },
        data: { balance: { decrement: Number(trx.amount) } },
      });
    }
  }

  private async validateAndApplyMutation(tx, workspaceId, data) {
    const fromAccount = await tx.account.findFirst({
      where: {
        id: data.accountId,
        workspaceId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!fromAccount) {
      throw new NotFoundException('Account not found or inactive');
    }

    if (data.type === 'EXPENSE' || data.type === 'TRANSFER') {
      if (Number(fromAccount.balance) < data.amount) {
        throw new BadRequestException('Insufficient balance');
      }
    }

    if (data.type === 'INCOME') {
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { increment: data.amount } },
      });
    }

    if (data.type === 'EXPENSE') {
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: data.amount } },
      });
    }

    if (data.type === 'TRANSFER') {
      const toAccount = await tx.account.findFirst({
        where: {
          id: data.toAccountId,
          workspaceId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!toAccount) {
        throw new NotFoundException('Destination account not found');
      }

      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: data.amount } },
      });

      await tx.account.update({
        where: { id: toAccount.id },
        data: { balance: { increment: data.amount } },
      });
    }
  }

  async uploadAttachment(
    transactionId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    const trx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!trx) {
      throw new NotFoundException('Transaction not found');
    }

    const uploaded = await this.storageService.uploadTransactionAttachment(
      transactionId,
      file,
    );

    return this.prisma.transactionAttachment.create({
      data: {
        transactionId,
        key: uploaded.key,
        fileName: file.originalname,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        uploadedById: userId,
      },
    });
  }
}
