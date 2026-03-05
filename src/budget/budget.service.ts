import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateBudgetDto) {
    // 🔎 1. Validate category exists, belongs to workspace, and is EXPENSE type
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        workspaceId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found or inactive');
    }

    if (category.type !== 'EXPENSE') {
      throw new BadRequestException(
        'Budget can only be set for EXPENSE categories',
      );
    }

    // 🔎 2. Cek duplikat aktif
    const existing = await this.prisma.budget.findFirst({
      where: {
        workspaceId,
        categoryId: dto.categoryId,
        month: dto.month,
        year: dto.year,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Budget for this category and month/year already exists',
      );
    }

    // 🔄 3. Cek apakah ada soft-deleted row untuk kombinasi yang sama
    const deleted = await this.prisma.budget.findFirst({
      where: {
        workspaceId,
        categoryId: dto.categoryId,
        month: dto.month,
        year: dto.year,
        deletedAt: { not: null }, // yang sudah di-delete
      },
    });

    if (deleted) {
      // Restore + update amount
      const budget = await this.prisma.budget.update({
        where: { id: deleted.id },
        data: {
          amount: dto.amount,
          deletedAt: null, // restore
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              icon: true,
              color: true,
            },
          },
        },
      });
      return this.formatBudgetResponse(budget, null);
    }

    // 📝 3. Create budget
    const budget = await this.prisma.budget.create({
      data: {
        workspaceId,
        categoryId: dto.categoryId,
        month: dto.month,
        year: dto.year,
        amount: dto.amount,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    return this.formatBudgetResponse(budget, null);
  }

  async update(workspaceId: string, id: string, dto: UpdateBudgetDto) {
    // 🔎 1. Check budget exists
    const existing = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Budget not found');
    }

    // 🔎 2. If categoryId/month/year changed, validate no duplicate
    const categoryId = dto.categoryId ?? existing.categoryId;
    const month = dto.month ?? existing.month;
    const year = dto.year ?? existing.year;

    const isCategoryMonthYearChanged =
      categoryId !== existing.categoryId ||
      month !== existing.month ||
      year !== existing.year;

    if (isCategoryMonthYearChanged) {
      // Validate new category is EXPENSE
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, workspaceId, deletedAt: null, isActive: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found or inactive');
      }

      if (category.type !== 'EXPENSE') {
        throw new BadRequestException(
          'Budget can only be set for EXPENSE categories',
        );
      }

      // Check duplicate for new combination
      const duplicate = await this.prisma.budget.findFirst({
        where: {
          workspaceId,
          categoryId,
          month,
          year,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          'Budget for this category and month/year already exists',
        );
      }
    }

    // 📝 3. Update
    const budget = await this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.month && { month: dto.month }),
        ...(dto.year && { year: dto.year }),
        ...(dto.amount && { amount: dto.amount }),
      },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    return this.formatBudgetResponse(budget, null);
  }

  async findAll(workspaceId: string, query: BudgetQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const isFiltered = query.month !== undefined && query.year !== undefined;

    const whereBase = {
      workspaceId,
      deletedAt: null,
      ...(isFiltered && { month: query.month, year: query.year }),
    };

    const [budgets, total] = await this.prisma.$transaction([
      this.prisma.budget.findMany({
        where: whereBase,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              icon: true,
              color: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' }, // terbaru dulu
        skip,
        take: limit,
      }),
      this.prisma.budget.count({ where: whereBase }),
    ]);

    if (budgets.length === 0) {
      return {
        items: [],
        meta: { total: 0, page, limit, lastPage: 0 },
      };
    }

    // 📊 Hitung actual expense — hanya kalau filter month/year aktif
    let actualMap = new Map<string, number>();

    if (isFiltered) {
      const startDate = new Date(query.year!, query.month! - 1, 1);
      const endDate = new Date(query.year!, query.month!, 0, 23, 59, 59, 999);
      const categoryIds = budgets.map((b) => b.categoryId);

      const actuals = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          workspaceId,
          type: 'EXPENSE',
          categoryId: { in: categoryIds },
          transactionDate: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        _sum: { amount: true },
      });

      actualMap = new Map(
        actuals.map((a) => [a.categoryId!, Number(a._sum.amount ?? 0)]),
      );
    }

    const items = budgets.map((budget) => {
      const actualExpense = isFiltered
        ? (actualMap.get(budget.categoryId) ?? 0)
        : null; // null = tidak dihitung kalau tidak filter
      return this.formatBudgetResponse(budget, actualExpense);
    });

    return {
      items,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(workspaceId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        category: {
          select: { id: true, name: true, type: true, icon: true, color: true },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    // 📊 Get actual expense for this budget's month/year/category
    const startDate = new Date(budget.year, budget.month - 1, 1);
    const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59, 999);

    const actual = await this.prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'EXPENSE',
        categoryId: budget.categoryId,
        transactionDate: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const actualExpense = Number(actual._sum.amount ?? 0);

    return this.formatBudgetResponse(budget, actualExpense);
  }

  async remove(workspaceId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.prisma.budget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Budget deleted successfully' };
  }

  // 🧮 Helper: format budget response with actual vs budget calculation
  private formatBudgetResponse(budget: any, actualExpense: number | null) {
    const budgetAmount = Number(budget.amount);
    const actual = actualExpense ?? 0;
    const remaining = budgetAmount - actual;
    const percentUsed =
      budgetAmount > 0
        ? Math.min(Math.round((actual / budgetAmount) * 100 * 100) / 100, 100)
        : 0;

    return {
      id: budget.id,
      month: budget.month,
      year: budget.year,
      budgetAmount,
      category: budget.category,
      ...(actualExpense !== null && {
        actualExpense: actual,
        remaining,
        percentUsed,
        isOverBudget: actual > budgetAmount,
      }),
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
