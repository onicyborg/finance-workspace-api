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
import { SavingGoalsService } from './saving-goals.service';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { SavingGoalQueryDto } from './dto/saving-goal-query.dto';

@Controller('workspaces/:workspaceId/saving-goals')
@ApiBearerAuth('access-token')
export class SavingGoalsController {
  constructor(private readonly savingGoalsService: SavingGoalsService) {}

  @ApiOperation({ summary: 'Create saving goal' })
  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateSavingGoalDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.savingGoalsService.create(workspaceId, dto);
  }

  @ApiOperation({ summary: 'List saving goals' })
  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SavingGoalQueryDto,
  ) {
    return this.savingGoalsService.findAll(workspaceId, query);
  }

  @ApiOperation({ summary: 'Get saving goal detail' })
  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.savingGoalsService.findOne(workspaceId, id);
  }

  @ApiOperation({ summary: 'Update saving goal' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
    @Body() dto: UpdateSavingGoalDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.savingGoalsService.update(workspaceId, id, dto);
  }

  @ApiOperation({ summary: 'Delete saving goal' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const role = req.workspaceMember.role;

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can delete saving goal');
    }

    return this.savingGoalsService.remove(workspaceId, id);
  }

  @ApiOperation({ summary: 'Get contribution history of a saving goal' })
  @Get(':id/contributions')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  getContributions(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Query() query: SavingGoalQueryDto,
  ) {
    return this.savingGoalsService.getContributions(workspaceId, id, query);
  }
}