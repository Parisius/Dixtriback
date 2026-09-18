import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../constants/roles.enum';

/**
 * Applied globally alongside JwtAuthGuard. Checks the roles set by @Roles(...)
 * against the authenticated user's role. A route with no @Roles(...) is
 * allowed for any authenticated user (role check is opt-in, per-route).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const allowed = requiredRoles.includes(user.role);
    if (!allowed) {
      throw new ForbiddenException(
        `Ce rôle (${user.role}) n'est pas autorisé pour cette action.`,
      );
    }
    return true;
  }
}
