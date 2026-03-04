import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  private readonly accountTypes = ['CASH', 'BANK', 'EWALLET', 'SAVING'] as const;

  async create(workspaceId: string, dto: CreateAccountDto) {
    const balance = dto.initialBalance ?? 0;

    return this.prisma.account.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency ?? 'IDR',
        balance,
      },
    });
  }

  async metaFilter(workspaceId: string) {
    const types = await this.prisma.account.findMany({
      where : { workspaceId, deletedAt: null },
      distinct : ['type'],
      select : { type : true }
    })

    const currencies = await this.prisma.account.findMany({
      where : { workspaceId, deletedAt: null },
      distinct : ['currency'],
      select : { currency : true }
    })

    const statuses = ['ACTIVE', 'INACTIVE']

    return { types : types.map((t) => t.type), currencies : currencies.map((c) => c.currency), statuses }
  }

  async findAll(workspaceId: string, query: AccountQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50); // safety cap
    const skip = (page - 1) * limit;

    const where: any = {
      workspaceId,
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.type && query.type.length > 0) {
      where.type = {
        in: query.type
      };
    }

    if (query.search) {
      const search = query.search.trim();
      const searchUpper = search.toUpperCase();

      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          currency: {
            contains: search,
            mode: 'insensitive',
          },
        },
        ...(this.accountTypes.includes(searchUpper as any)
          ? [{ type: searchUpper }]
          : []),
      ];
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.account.count({ where }),
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

  async findOne(workspaceId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  async update(workspaceId: string, accountId: string, dto: UpdateAccountDto) {
    await this.findOne(workspaceId, accountId);

    return this.prisma.account.update({
      where: { id: accountId },
      data: dto,
    });
  }

  async delete(workspaceId: string, accountId: string) {
    await this.findOne(workspaceId, accountId);

    const transactionCount = await this.prisma.transaction.count({
      where: {
        workspaceId,
        OR: [{ accountId: accountId }, { toAccountId: accountId }],
      },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with existing transactions',
      );
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
