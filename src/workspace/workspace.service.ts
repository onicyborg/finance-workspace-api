import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

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

  async addMember(workspaceId: string, dto: AddMemberDto) {
    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: dto.userId,
        role: dto.role,
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

  async updateMember(workspaceId: string, userId: string, dto: UpdateMemberDto) {
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
