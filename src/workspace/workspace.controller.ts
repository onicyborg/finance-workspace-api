import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Param,
  ForbiddenException,
  Delete,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';
import { UpdateMemberDto } from './dto/update-member.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  //   WORKSPACE

  @ApiOperation({ summary: 'Create new workspace' })
  @Post()
  create(@Req() req, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.createWorkspace(req.user.userId, dto);
  }

  @ApiOperation({ summary: 'List user workspaces' })
  @Get()
  list(@Req() req) {
    return this.workspaceService.listUserWorkspaces(req.user.userId);
  }

  @ApiOperation({ summary: 'Get workspace detail' })
  @UseGuards(WorkspaceMemberGuard)
  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.workspaceService.getWorkspaceById(id);
  }

  @ApiOperation({ summary: 'Update Workspace' })
  @UseGuards(WorkspaceMemberGuard)
  @Patch(':id')
  updateWorkspace(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.updateWorkspace(id, dto);
  }

  @ApiOperation({ summary: 'Delete Workspace' })
  @UseGuards(WorkspaceMemberGuard)
  @Delete(':id')
  deleteWorkspace(@Param('id') id: string) {
    return this.workspaceService.deleteWorkspace(id);
  }

  //   MEMBER WORKSPACE

  @ApiOperation({ summary: 'Invite user to workspace (OWNER only)' })
  @UseGuards(WorkspaceMemberGuard)
  @Post(':id/invitations')
  invite(@Param('id') id: string, @Req() req, @Body() dto: InviteUserDto) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can invite users');
    }

    return this.workspaceService.inviteUser(id, req.user.userId, dto);
  }

  @ApiOperation({ summary: 'Get my invitations' })
  @Get('invitations/me')
  getMyInvitations(@Req() req) {
    return this.workspaceService.getMyInvitations(req.user.userId);
  }

  @ApiOperation({ summary: 'Accept invitation' })
  @Post('invitations/:id/accept')
  acceptInvitation(@Param('id') id: string, @Req() req) {
    return this.workspaceService.acceptInvitation(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Reject invitation' })
  @Post('invitations/:id/reject')
  rejectInvitation(@Param('id') id: string, @Req() req) {
    return this.workspaceService.rejectInvitation(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Get workspace members' })
  @UseGuards(WorkspaceMemberGuard)
  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.workspaceService.getWorkspaceMembers(id);
  }

  @ApiOperation({ summary: 'Update member role in workspace (OWNER only)' })
  @UseGuards(WorkspaceMemberGuard)
  @Patch(':id/members/:userId')
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req,
  ) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can update member role');
    }

    return this.workspaceService.updateMember(id, userId, dto);
  }

  @ApiOperation({ summary: 'Remove member from workspace (OWNER only)' })
  @UseGuards(WorkspaceMemberGuard)
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can remove members');
    }

    return this.workspaceService.removeMember(id, userId);
  }
}
