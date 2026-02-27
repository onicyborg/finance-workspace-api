import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(workspaceId: string) {
    return this.prisma.account.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
