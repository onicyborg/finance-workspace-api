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
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

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

  @ApiOperation({ summary: 'Delete Workspace' })
  @UseGuards(WorkspaceMemberGuard)
  @Delete(':id')
  deleteWorkspace(@Param('id') id: string) {
    return this.workspaceService.deleteWorkspace(id);
  }

  //   MEMBER WORKSPACE

  @ApiOperation({ summary: 'Add member to workspace (OWNER only)' })
  @UseGuards(WorkspaceMemberGuard)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @Req() req) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can add members');
    }

    return this.workspaceService.addMember(id, dto);
  }

  @ApiOperation({ summary: 'Get workspace members' })
  @UseGuards(WorkspaceMemberGuard)
  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.workspaceService.getWorkspaceMembers(id);
  }

  @ApiOperation({ summary: "Update member role in workspace (OWNER only)" })
  @UseGuards(WorkspaceMemberGuard)
  @Patch(':id/members/:userId')
  updateMember(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateMemberDto, @Req() req) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can update member role');
    }

    return this.workspaceService.updateMember(id, userId, dto);
  }

  @ApiOperation({ summary: 'Remove member from workspace (OWNER only)' })
  @UseGuards(WorkspaceMemberGuard)
  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req) {
    if (req.workspaceMember.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can remove members');
    }

    return this.workspaceService.removeMember(id, userId);
  }
  
}
