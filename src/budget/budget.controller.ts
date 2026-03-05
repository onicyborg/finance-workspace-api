import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspace/guards/workspace-member.guard';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';

@Controller('workspaces/:workspaceId/budgets')
@ApiBearerAuth('access-token')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @ApiOperation({ summary: 'Create budget for a category' })
  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateBudgetDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.budgetService.create(workspaceId, dto);
  }

  @ApiOperation({ summary: 'List budgets with actual expense for a month' })
  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetService.findAll(workspaceId, query);
  }

  @ApiOperation({ summary: 'Get budget detail by ID' })
  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.budgetService.findOne(workspaceId, id);
  }

  @ApiOperation({ summary: 'Update budget amount' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
    @Body() dto: UpdateBudgetDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.budgetService.update(workspaceId, id, dto);
  }

  @ApiOperation({ summary: 'Delete budget' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const role = req.workspaceMember.role;

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can delete budget');
    }

    return this.budgetService.remove(workspaceId, id);
  }
}