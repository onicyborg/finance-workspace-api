/*
  Warnings:

  - You are about to drop the `WorkspaceInvitation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT "WorkspaceInvitation_inviteeUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT "WorkspaceInvitation_inviterUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT "WorkspaceInvitation_workspaceId_fkey";

-- DropTable
DROP TABLE "WorkspaceInvitation";

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "inviterUserId" UUID NOT NULL,
    "inviteeUserId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_invitations_inviteeUserId_idx" ON "workspace_invitations"("inviteeUserId");

-- CreateIndex
CREATE INDEX "workspace_invitations_status_idx" ON "workspace_invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_workspaceId_inviteeUserId_key" ON "workspace_invitations"("workspaceId", "inviteeUserId");

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
