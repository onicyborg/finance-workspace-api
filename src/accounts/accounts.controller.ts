import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Get,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspace/guards/workspace-member.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountsService } from './accounts.service';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() dto: CreateAccountDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.accountsService.create(workspaceId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.accountsService.findAll(workspaceId);
  }

  @Get(':accountId')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  findOne(@Param('workspaceId') workspaceId: string, @Param('accountId') accountId: string) {
    return this.accountsService.findOne(workspaceId, accountId);
  }

  @Patch(':accountId')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Req() req,
    @Body() dto: UpdateAccountDto,
  ) {
    const role = req.workspaceMember.role;

    if (!['OWNER', 'EDITOR'].includes(role)) {
      throw new ForbiddenException('Insufficient permission');
    }

    return this.accountsService.update(workspaceId, accountId, dto);
  }

  @Delete(':accountId')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  delete(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @Req() req,
  ) {
    const role = req.workspaceMember.role;

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can delete account');
    }

    return this.accountsService.delete(workspaceId, accountId);
  }
}
