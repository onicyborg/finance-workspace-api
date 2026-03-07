import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Account } from '@prisma/client';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { StorageService } from '../storage/storage.service';
import { SavingGoalsService } from '../saving-goals/saving-goals.service';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private savingGoalsService: SavingGoalsService, // ← inject SavingGoalsService
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
          data: { balance: { increment: dto.amount } },
        });
      }

      if (dto.type === 'EXPENSE') {
        await tx.account.update({
          where: { id: fromAccount.id },
          data: { balance: { decrement: dto.amount } },
        });
      }

      if (dto.type === 'TRANSFER') {
        await tx.account.update({
          where: { id: fromAccount.id },
          data: { balance: { decrement: dto.amount } },
        });

        await tx.account.update({
          where: { id: toAccount?.id },
          data: { balance: { increment: dto.amount } },
        });
      }

      // 📝 4. Create Transaction Record
      const transaction = await tx.transaction.create({
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

      // 🎯 5. Sync saving goals untuk account yang terdampak
      await this.savingGoalsService.syncGoalsByAccount(
        tx,
        workspaceId,
        dto.accountId,
      );
      if (dto.type === 'TRANSFER' && dto.toAccountId) {
        await this.savingGoalsService.syncGoalsByAccount(
          tx,
          workspaceId,
          dto.toAccountId,
        );
      }

      return transaction;
    });
  }

  async metaFilter(workspaceId: string) {
    const types = ['INCOME', 'EXPENSE', 'TRANSFER'];

    const categories = await this.prisma.category.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });

    const accounts = await this.prisma.account.findMany({
      where: { workspaceId, deletedAt: null },
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

    if (query.type) {
      where.type = query.type;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.accountId) {
      where.OR = [
        { accountId: query.accountId },
        { toAccountId: query.accountId },
      ];
    }

    if (query.startDate || query.endDate) {
      where.transactionDate = {};

      if (query.startDate) {
        const startDate = new Date(query.startDate);
        startDate.setHours(0, 0, 0, 0);
        where.transactionDate.gte = startDate;
      }

      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.transactionDate.lte = endDate;
      }
    } else {
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
        orderBy: { transactionDate: 'desc' },
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

  async getTransactionById(workspaceId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        account: true,
        toAccount: true,
        category: true,
        attachments: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const attachments = await Promise.all(
      transaction.attachments.map(async (attachment) => {
        const downloadUrl = await this.storageService.generateDownloadUrl(
          attachment.key,
        );

        return {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          createdAt: attachment.createdAt,
          downloadUrl,
        };
      }),
    );

    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      transactionDate: transaction.transactionDate,
      createdAt: transaction.createdAt,

      account: {
        id: transaction.account.id,
        name: transaction.account.name,
        type: transaction.account.type,
      },

      toAccount:
        transaction.type === 'TRANSFER' && transaction.toAccount
          ? {
              id: transaction.toAccount.id,
              name: transaction.toAccount.name,
              type: transaction.toAccount.type,
            }
          : null,

      category: transaction.category
        ? {
            id: transaction.category.id,
            name: transaction.category.name,
            type: transaction.category.type,
          }
        : null,

      attachments,
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
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...newData,
          updatedById: userId,
        },
      });

      // 🎯 5️⃣ Sync saving goals untuk semua account yang terdampak
      // (account lama + account baru, termasuk toAccount keduanya)
      const affectedAccounts = new Set<string>([
        existing.accountId,
        newData.accountId,
        ...(existing.toAccountId ? [existing.toAccountId] : []),
        ...(newData.toAccountId ? [newData.toAccountId] : []),
      ]);

      for (const accountId of affectedAccounts) {
        await this.savingGoalsService.syncGoalsByAccount(
          tx,
          workspaceId,
          accountId,
        );
      }

      return updated;
    });
  }

  async delete(workspaceId: string, id: string, userId: string) {
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
          'Transaction can only be deleted within 5 minutes of creation',
        );
      }

      // 🔁 Reverse mutation
      await this.reverseMutation(tx, existing);

      // 🗑 Soft delete
      const deleted = await tx.transaction.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedById: userId,
        },
      });

      // 🎯 Sync saving goals untuk account yang terdampak
      await this.savingGoalsService.syncGoalsByAccount(
        tx,
        workspaceId,
        existing.accountId,
      );
      if (existing.toAccountId) {
        await this.savingGoalsService.syncGoalsByAccount(
          tx,
          workspaceId,
          existing.toAccountId,
        );
      }

      return deleted;
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
    const [created] = await this.uploadAttachments(
      '',
      transactionId,
      [file],
      userId,
    );
    return created;
  }

  async uploadAttachments(
    workspaceId: string,
    transactionId: string,
    files: Express.Multer.File[],
    userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('User id is required');
    }

    if (!files?.length) {
      throw new BadRequestException('File is required');
    }

    const trx = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        ...(workspaceId ? { workspaceId } : {}),
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!trx) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (const file of files) {
        const uploaded = await this.storageService.uploadTransactionAttachment(
          transactionId,
          file,
        );

        created.push(
          await tx.transactionAttachment.create({
            data: {
              transactionId,
              key: uploaded.key,
              fileName: file.originalname,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
              uploadedById: userId,
            },
          }),
        );
      }

      return created;
    });
  }

  async getAttachmentDownloadUrl(attachmentId: string, userId: string) {
    const attachment = await this.prisma.transactionAttachment.findUnique({
      where: { id: attachmentId },
      include: { transaction: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: attachment.transaction.workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const url = await this.storageService.generateDownloadUrl(attachment.key);

    return { downloadUrl: url };
  }
}
