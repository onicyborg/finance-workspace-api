import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
      },
    });
  }

  async findAll(workspaceId: string, query: CategoryQueryDto) {
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

    if (query.type !== undefined && query.type.length > 0) {
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
        }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
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

  async findOne(workspaceId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(workspaceId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(workspaceId, id);

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async delete(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);

    const usedCount = await this.prisma.transaction.count({
      where: {
        workspaceId,
        categoryId: id,
      },
    });

    if (usedCount > 0) {
      throw new BadRequestException(
        'Cannot delete category that is already used in transactions',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
