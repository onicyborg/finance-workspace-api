import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { PdfService } from './pdf.service';
import { generateMonthlyReportHtml } from './reports-template';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async getMonthlyReport(workspaceId: string, query: MonthlyReportQueryDto) {
    const { month, year } = query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Base where tanpa filter type — include semua transaksi
    const baseWhere = {
      workspaceId,
      deletedAt: null,
      transactionDate: { gte: startDate, lte: endDate },
    };

    // Where khusus income/expense (exclude transfer)
    const incomeExpenseWhere = {
      ...baseWhere,
      type: { not: 'TRANSFER' as const },
    };

    const [workspace, summary, byCategory, byAccount, byTransfer, daily, budgets] =
      await Promise.all([
        this.getWorkspace(workspaceId),
        this.getSummary(workspaceId, baseWhere),
        this.getByCategory(workspaceId, incomeExpenseWhere),
        this.getByAccount(workspaceId, incomeExpenseWhere),
        this.getTransfers(workspaceId, baseWhere),
        this.getDaily(workspaceId, baseWhere, startDate, endDate),
        this.getBudgets(workspaceId, month, year),
      ]);

    const byCategoryWithBudget = this.mergeCategoryWithBudget(
      byCategory,
      budgets,
    );

    return {
      workspace: { name: workspace.name },
      period: { month, year, startDate, endDate },
      summary,
      byCategory: byCategoryWithBudget,
      byAccount,
      byTransfer,
      daily,
    };
  }

  async exportMonthlyReportPdf(
    workspaceId: string,
    query: MonthlyReportQueryDto,
  ): Promise<Buffer> {
    const report = await this.getMonthlyReport(workspaceId, query);
    const html = generateMonthlyReportHtml(report);
    return this.pdfService.generatePdf(html);
  }

  // ──────────────────────────────────────────────
  // WORKSPACE
  // ──────────────────────────────────────────────
  private async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { name: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    return workspace;
  }

  // ──────────────────────────────────────────────
  // 1. SUMMARY
  // ──────────────────────────────────────────────
  private async getSummary(workspaceId: string, baseWhere: any) {
    const [incomeResult, expenseResult, transferResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'TRANSFER' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const totalIncome = Number(incomeResult._sum.amount ?? 0);
    const totalExpense = Number(expenseResult._sum.amount ?? 0);
    const totalTransfer = Number(transferResult._sum.amount ?? 0);
    const totalTransferCount = transferResult._count.id ?? 0;

    return {
      totalIncome,
      totalExpense,
      netCashflow: totalIncome - totalExpense,
      totalTransfer,
      totalTransferCount,
    };
  }

  // ──────────────────────────────────────────────
  // 2. BY CATEGORY
  // ──────────────────────────────────────────────
  private async getByCategory(workspaceId: string, incomeExpenseWhere: any) {
    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { ...incomeExpenseWhere, categoryId: { not: null } },
      _sum: { amount: true },
    });

    if (transactions.length === 0) return [];

    const categoryIds = [...new Set(transactions.map((t) => t.categoryId!))];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, deletedAt: null },
      select: { id: true, name: true, type: true, icon: true, color: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const totalByType = transactions.reduce(
      (acc, t) => {
        const amount = Number(t._sum.amount ?? 0);
        if (t.type === 'INCOME') acc.income += amount;
        if (t.type === 'EXPENSE') acc.expense += amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const grouped = new Map<
      string,
      { total: number; type: string; category: any }
    >();

    for (const t of transactions) {
      const categoryId = t.categoryId!;
      const amount = Number(t._sum.amount ?? 0);
      const category = categoryMap.get(categoryId);
      if (!category) continue;

      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, { total: 0, type: t.type, category });
      }
      grouped.get(categoryId)!.total += amount;
    }

    return Array.from(grouped.values()).map(({ total, type, category }) => {
      const grandTotal =
        type === 'INCOME' ? totalByType.income : totalByType.expense;
      const percentage =
        grandTotal > 0
          ? Math.round((total / grandTotal) * 100 * 100) / 100
          : 0;

      return { category, type, total, percentage };
    });
  }

  // ──────────────────────────────────────────────
  // 3. BY ACCOUNT
  // ──────────────────────────────────────────────
  private async getByAccount(workspaceId: string, incomeExpenseWhere: any) {
    const transactions = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: incomeExpenseWhere,
      _sum: { amount: true },
    });

    if (transactions.length === 0) return [];

    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, deletedAt: null },
      select: { id: true, name: true, type: true, currency: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const grouped = new Map<
      string,
      { account: any; totalIncome: number; totalExpense: number }
    >();

    for (const t of transactions) {
      const account = accountMap.get(t.accountId);
      if (!account) continue;

      if (!grouped.has(t.accountId)) {
        grouped.set(t.accountId, { account, totalIncome: 0, totalExpense: 0 });
      }

      const entry = grouped.get(t.accountId)!;
      const amount = Number(t._sum.amount ?? 0);

      if (t.type === 'INCOME') entry.totalIncome += amount;
      if (t.type === 'EXPENSE') entry.totalExpense += amount;
    }

    return Array.from(grouped.values());
  }

  // ──────────────────────────────────────────────
  // 4. TRANSFERS
  // ──────────────────────────────────────────────
  private async getTransfers(workspaceId: string, baseWhere: any) {
    const transfers = await this.prisma.transaction.findMany({
      where: { ...baseWhere, type: 'TRANSFER' },
      select: {
        id: true,
        amount: true,
        description: true,
        transactionDate: true,
        account: { select: { id: true, name: true, type: true } },
        toAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      description: t.description,
      transactionDate: t.transactionDate,
      fromAccount: t.account,
      toAccount: t.toAccount,
    }));
  }

  // ──────────────────────────────────────────────
  // 5. DAILY
  // ──────────────────────────────────────────────
  private async getDaily(
    workspaceId: string,
    baseWhere: any,
    startDate: Date,
    endDate: Date,
  ) {
    const transactions = await this.prisma.transaction.findMany({
      where: baseWhere,
      select: { type: true, amount: true, transactionDate: true },
      orderBy: { transactionDate: 'asc' },
    });

    const dailyMap = new Map<
      string,
      { totalIncome: number; totalExpense: number; totalTransfer: number }
    >();

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      dailyMap.set(dateKey, {
        totalIncome: 0,
        totalExpense: 0,
        totalTransfer: 0,
      });
      current.setDate(current.getDate() + 1);
    }

    for (const t of transactions) {
      const dateKey = t.transactionDate.toISOString().split('T')[0];
      const entry = dailyMap.get(dateKey);
      if (!entry) continue;

      const amount = Number(t.amount);
      if (t.type === 'INCOME') entry.totalIncome += amount;
      if (t.type === 'EXPENSE') entry.totalExpense += amount;
      if (t.type === 'TRANSFER') entry.totalTransfer += amount;
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  // ──────────────────────────────────────────────
  // 6. BUDGETS
  // ──────────────────────────────────────────────
  private async getBudgets(workspaceId: string, month: number, year: number) {
    return this.prisma.budget.findMany({
      where: { workspaceId, month, year, deletedAt: null },
      select: { categoryId: true, amount: true },
    });
  }

  // ──────────────────────────────────────────────
  // 7. MERGE CATEGORY + BUDGET
  // ──────────────────────────────────────────────
  private mergeCategoryWithBudget(
    byCategory: any[],
    budgets: { categoryId: string; amount: any }[],
  ) {
    const budgetMap = new Map(
      budgets.map((b) => [b.categoryId, Number(b.amount)]),
    );

    return byCategory.map((item) => {
      const budgetAmount = budgetMap.get(item.category.id) ?? null;

      if (budgetAmount === null || item.type !== 'EXPENSE') {
        return { ...item, budget: null };
      }

      const remaining = budgetAmount - item.total;
      const percentUsed =
        budgetAmount > 0
          ? Math.min(
              Math.round((item.total / budgetAmount) * 100 * 100) / 100,
              100,
            )
          : 0;

      return {
        ...item,
        budget: {
          budgetAmount,
          remaining,
          percentUsed,
          isOverBudget: item.total > budgetAmount,
        },
      };
    });
  }
}