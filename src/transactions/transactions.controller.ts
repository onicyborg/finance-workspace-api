import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspace/guards/workspace-member.guard';
import { Param, Req, Body } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('workspaces/:workspaceId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({ summary: 'Create transaction' })
  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateTransactionDto,
  ) {
    const role = req.workspaceMember.role;
    const userId = req.user.userId;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.transactionsService.create(workspaceId, dto, userId);
  }

  @ApiOperation({ summary: 'Get transactions filter metadata' })
  @Get('meta')
  @UseGuards(JwtAuthGuard)
  metaFilter(@Param('workspaceId') workspaceId: string) {
    return this.transactionsService.metaFilter(workspaceId);
  }

  @ApiOperation({ summary: 'List transactions' })
  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionsService.findAll(workspaceId, query);
  }

  @ApiOperation({ summary: 'Get Detail Transactions' })
  @Get(':transactionId')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  async getTransactionById(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionsService.getTransactionById(
      workspaceId,
      transactionId,
    );
  }

  @ApiOperation({ summary: 'Update transaction' })
  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
    @Body() dto: UpdateTransactionDto,
  ) {
    const role = req.workspaceMember.role;
    const userId = req.user.userId;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.transactionsService.update(workspaceId, id, dto, userId);
  }

  @ApiOperation({ summary: 'Delete transaction' })
  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const role = req.workspaceMember.role;
    const userId = req.user.userId;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.transactionsService.delete(workspaceId, id, userId);
  }

  @Post(':transactionId/attachments')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async uploadAttachment(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
  ) {
    if (!files?.length) {
      throw new ForbiddenException('File is required');
    }

    return this.transactionsService.uploadAttachments(
      workspaceId,
      transactionId,
      files,
      req.user.userId,
    );
  }

  @Get('attachments/:attachmentId/download')
  @UseGuards(JwtAuthGuard)
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Req() req,
  ) {
    return this.transactionsService.getAttachmentDownloadUrl(
      attachmentId,
      req.user.userId,
    );
  }
}
