import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { MailService } from 'src/mail/mail.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  // WORKSPACE

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
        },
      });

      await tx.category.createMany({
        data: [
          // INCOME
          { workspaceId: workspace.id, name: 'Salary', type: 'INCOME' },
          { workspaceId: workspace.id, name: 'Bonus', type: 'INCOME' },
          { workspaceId: workspace.id, name: 'Investment', type: 'INCOME' },
          { workspaceId: workspace.id, name: 'Other Income', type: 'INCOME' },

          // EXPENSE
          { workspaceId: workspace.id, name: 'Food', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Transport', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Bills', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Entertainment', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Shopping', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Health', type: 'EXPENSE' },
          { workspaceId: workspace.id, name: 'Other Expense', type: 'EXPENSE' },
        ],
      });

      return workspace;
    });
  }

  async listUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
        deletedAt: null,
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
  }

  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto){
    const workspace = await this.getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.workspace.update(
      {
        where: { id: workspaceId },
        data: dto,
      }
    )
  }

  async getWorkspaceById(workspaceId: string) {
    return this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
      },
    });
  }

  async deleteWorkspace(workspaceId: string) {
    return this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // MEMBER WORKSPACE

  async inviteUser(
    workspaceId: string,
    inviterUserId: string,
    dto: InviteUserDto,
  ) {
    // Cari user by username/email
    const targetUser = dto.usernameOrEmail.includes('@')
      ? await this.prisma.user.findUnique({
          where: { email: dto.usernameOrEmail },
        })
      : await this.prisma.user.findUnique({
          where: { username: dto.usernameOrEmail },
        });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === inviterUserId) {
      throw new BadRequestException('You cannot invite yourself');
    }

    // Cek sudah member?
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member');
    }

    // Cek sudah ada invitation?
    const existingInvitation = await this.prisma.workspaceInvitation.findUnique(
      {
        where: {
          workspaceId_inviteeUserId: {
            workspaceId,
            inviteeUserId: targetUser.id,
          },
        },
      },
    );

    if (existingInvitation) {
      if (existingInvitation.status === 'PENDING') {
        throw new BadRequestException('Invitation already sent');
      }
      
      // Hapus invitation lama (REJECTED/EXPIRED) untuk buat baru
      await this.prisma.workspaceInvitation.delete({
        where: {
          workspaceId_inviteeUserId: {
            workspaceId,
            inviteeUserId: targetUser.id,
          },
        },
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        inviterUserId,
        inviteeUserId: targetUser.id,
        role: dto.role,
        expiresAt,
      },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterUserId },
    });

    this.mailService
      .sendWorkspaceInvitationEmail(
        targetUser.email,
        inviter?.name ?? 'Someone',
        workspace?.name ?? 'Finance Workspace',
        dto.role,
        expiresAt,
      )
      .catch((err) => {
        console.error('Failed to send invitation email:', err);
      });

    return invitation;
  }

  async getMyInvitations(userId: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: {
        inviteeUserId: userId,
        status: 'PENDING',
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async acceptInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.inviteeUserId !== userId) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      }),
      this.prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      }),
    ]);

    return { message: 'Invitation accepted successfully' };
  }

  async rejectInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.inviteeUserId !== userId) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    return this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });
  }

  async getWorkspaceMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async updateMember(
    workspaceId: string,
    userId: string,
    dto: UpdateMemberDto,
  ) {
    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        role: dto.role,
      },
    });
  }

  async removeMember(workspaceId: string, userId: string) {
    const deletedMember = await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      message: 'Member removed successfully',
      removedMember: {
        id: deletedMember.id,
        role: deletedMember.role,
        user: deletedMember.user,
      },
    };
  }
}
