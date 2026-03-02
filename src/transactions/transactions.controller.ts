import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspace/guards/workspace-member.guard';
import { Param, Req, Body } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Controller('workspaces/:workspaceId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateTransactionDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.transactionsService.create(workspaceId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionsService.findAll(workspaceId, query);
  }
}
