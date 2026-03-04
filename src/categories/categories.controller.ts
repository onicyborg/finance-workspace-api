import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../workspace/guards/workspace-member.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

@Controller('workspaces/:workspaceId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Create category' })
  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateCategoryDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.categoriesService.create(workspaceId, dto);
  }

  @ApiOperation({ summary: 'List categories' })
  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(@Param('workspaceId') workspaceId: string, @Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(workspaceId, query);
  }

  @ApiOperation({ summary: 'Get category detail' })
  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(workspaceId, id);
  }

  @ApiOperation({ summary: 'Update category' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
    @Body() dto: UpdateCategoryDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.categoriesService.update(workspaceId, id, dto);
  }

  @ApiOperation({ summary: 'Delete category (OWNER only)' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const role = req.workspaceMember.role;

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can delete category');
    }

    return this.categoriesService.delete(workspaceId, id);
  }
}
