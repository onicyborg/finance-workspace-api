import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private requiredRole: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const member = request.workspaceMember;

    if (member.role !== this.requiredRole) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }
}