import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { SavingGoalQueryDto } from './dto/saving-goal-query.dto';

@Injectable()
export class SavingGoalsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateSavingGoalDto) {
    // 🔎 1. Validate account exists, belongs to workspace, and is active
    const account = await this.prisma.account.findFirst({
      where: {
        id: dto.accountId,
        workspaceId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found or inactive');
    }

    // 🔎 2. Validasi 1 account hanya boleh punya 1 saving goal (exclude soft deleted)
    const existingGoal = await this.prisma.savingGoal.findFirst({
      where: {
        accountId: dto.accountId,
        workspaceId,
        deletedAt: null, // ← exclude yang sudah di soft delete
      },
    });

    if (existingGoal) {
      throw new BadRequestException(
        'This account already has an active saving goal, please create a new account for another saving goal',
      );
    }

    // 📊 3. Calculate currentAmount from existing transactions on this account
    const currentAmount = await this.calculateCurrentAmount(
      workspaceId,
      dto.accountId,
    );

    const targetAmount = dto.targetAmount;
    const isCompleted = currentAmount >= targetAmount;

    // 📝 4. Create saving goal
    const savingGoal = await this.prisma.savingGoal.create({
      data: {
        workspaceId,
        accountId: dto.accountId,
        name: dto.name,
        targetAmount,
        currentAmount,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        isCompleted,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
      },
    });

    return savingGoal;
  }

  async findAll(workspaceId: string, query: SavingGoalQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const where: any = { workspaceId, deletedAt: null };

    if (query.isCompleted !== undefined) {
      where.isCompleted = query.isCompleted;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [savingGoals, total] = await this.prisma.$transaction([
      this.prisma.savingGoal.findMany({
        where,
        include: {
          account: {
            select: { id: true, name: true, type: true, currency: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.savingGoal.count({ where }),
    ]);

    return {
      items: savingGoals.map((g) => this.formatResponse(g)),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const savingGoal = await this.prisma.savingGoal.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
      },
    });

    if (!savingGoal) {
      throw new NotFoundException('Saving goal not found');
    }

    return this.formatResponse(savingGoal);
  }

  async update(workspaceId: string, id: string, dto: UpdateSavingGoalDto) {
    const existing = await this.prisma.savingGoal.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Saving goal not found');
    }

    // 🔎 Validate new account if changed
    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.prisma.account.findFirst({
        where: {
          id: dto.accountId,
          workspaceId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found or inactive');
      }
    }

    const targetAmount = dto.targetAmount ?? Number(existing.targetAmount);
    const currentAmount = Number(existing.currentAmount);
    const isCompleted = currentAmount >= targetAmount;

    const savingGoal = await this.prisma.savingGoal.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.accountId && { accountId: dto.accountId }),
        ...(dto.targetAmount && { targetAmount: dto.targetAmount }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
        isCompleted,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true, currency: true },
        },
      },
    });

    return this.formatResponse(savingGoal);
  }

  async remove(workspaceId: string, id: string) {
    const existing = await this.prisma.savingGoal.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Saving goal not found');
    }

    await this.prisma.savingGoal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Saving goal deleted successfully' };
  }

  async getContributions(
    workspaceId: string,
    id: string,
    query: SavingGoalQueryDto,
  ) {
    const savingGoal = await this.prisma.savingGoal.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { accountId: true },
    });

    if (!savingGoal) {
      throw new NotFoundException('Saving goal not found');
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    // 🔎 Ambil semua transaksi dari account terkait sebagai riwayat kontribusi
    const where: any = {
      workspaceId,
      deletedAt: null,
      OR: [
        // INCOME & EXPENSE langsung di account
        {
          accountId: savingGoal.accountId,
          type: { in: ['INCOME', 'EXPENSE'] },
        },
        // TRANSFER keluar dari account
        {
          accountId: savingGoal.accountId,
          type: 'TRANSFER',
        },
        // TRANSFER masuk ke account
        {
          toAccountId: savingGoal.accountId,
          type: 'TRANSFER',
        },
      ],
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          transactionDate: true,
          accountId: true,
          toAccountId: true,
          category: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // 🧮 Tentukan efek setiap transaksi terhadap saving goal
    const items = transactions.map((t) => {
      let effect: 'INCREMENT' | 'DECREMENT';
      const amount = Number(t.amount);

      if (t.type === 'INCOME') {
        effect = 'INCREMENT';
      } else if (t.type === 'EXPENSE') {
        effect = 'DECREMENT';
      } else {
        // TRANSFER: masuk ke account = INCREMENT, keluar dari account = DECREMENT
        effect =
          t.toAccountId === savingGoal.accountId ? 'INCREMENT' : 'DECREMENT';
      }

      return {
        id: t.id,
        type: t.type,
        effect,
        amount,
        effectiveAmount: effect === 'INCREMENT' ? amount : -amount,
        description: t.description,
        transactionDate: t.transactionDate,
        category: t.category,
      };
    });

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

  // ──────────────────────────────────────────────
  // SYNC — dipanggil dari TransactionsService
  // ──────────────────────────────────────────────

  /**
   * Sync currentAmount semua saving goals yang terhubung ke accountId tertentu.
   * Dipanggil dalam prisma.$transaction yang sama dengan mutasi transaksi.
   */
  async syncGoalsByAccount(
    tx: any,
    workspaceId: string,
    accountId: string,
  ): Promise<void> {
    // 🔎 Cari semua saving goals yang terhubung ke account ini
    const goals = await tx.savingGoal.findMany({
      where: { workspaceId, accountId, deletedAt: null, isCompleted: false },
      select: { id: true, targetAmount: true },
    });

    if (goals.length === 0) return;

    // 📊 Hitung currentAmount baru dari transaksi
    const currentAmount = await this.calculateCurrentAmountTx(
      tx,
      workspaceId,
      accountId,
    );

    // 🔄 Update semua goals yang terhubung
    for (const goal of goals) {
      const isCompleted = currentAmount >= Number(goal.targetAmount);

      await tx.savingGoal.update({
        where: { id: goal.id },
        data: { currentAmount, isCompleted },
      });
    }
  }

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────

  /**
   * Hitung currentAmount dari transaksi di luar prisma.$transaction
   */
  private async calculateCurrentAmount(
    workspaceId: string,
    accountId: string,
  ): Promise<number> {
    return this.calculateCurrentAmountTx(this.prisma, workspaceId, accountId);
  }

  /**
   * Hitung currentAmount dari transaksi — bisa dipakai di dalam/luar prisma.$transaction
   */
  async calculateCurrentAmountTx(
    tx: any,
    workspaceId: string,
    accountId: string,
  ): Promise<number> {
    const [incomeResult, expenseResult, transferOutResult, transferInResult] =
      await Promise.all([
        // INCOME di account ini
        tx.transaction.aggregate({
          where: {
            workspaceId,
            accountId,
            type: 'INCOME',
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        // EXPENSE di account ini
        tx.transaction.aggregate({
          where: {
            workspaceId,
            accountId,
            type: 'EXPENSE',
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        // TRANSFER keluar dari account ini
        tx.transaction.aggregate({
          where: {
            workspaceId,
            accountId,
            type: 'TRANSFER',
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        // TRANSFER masuk ke account ini
        tx.transaction.aggregate({
          where: {
            workspaceId,
            toAccountId: accountId,
            type: 'TRANSFER',
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ]);

    const income = Number(incomeResult._sum.amount ?? 0);
    const expense = Number(expenseResult._sum.amount ?? 0);
    const transferOut = Number(transferOutResult._sum.amount ?? 0);
    const transferIn = Number(transferInResult._sum.amount ?? 0);

    return income - expense - transferOut + transferIn;
  }

  private formatResponse(savingGoal: any) {
    const targetAmount = Number(savingGoal.targetAmount);
    const currentAmount = Number(savingGoal.currentAmount);
    const remaining = Math.max(targetAmount - currentAmount, 0);
    const percentAchieved =
      targetAmount > 0
        ? Math.min(
            Math.round((currentAmount / targetAmount) * 100 * 100) / 100,
            100,
          )
        : 0;

    return {
      id: savingGoal.id,
      name: savingGoal.name,
      targetAmount,
      currentAmount,
      remaining,
      percentAchieved,
      isCompleted: savingGoal.isCompleted,
      deadline: savingGoal.deadline,
      account: savingGoal.account,
      createdAt: savingGoal.createdAt,
      updatedAt: savingGoal.updatedAt,
    };
  }
}
