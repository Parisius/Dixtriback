import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { Role } from '../constants/roles.enum';
import { CustomRolesService } from '../../custom-roles/custom-roles.service';

/**
 * Applied globally alongside JwtAuthGuard. Checks the roles set by @Roles(...)
 * against the authenticated user's role. A route with no @Roles(...) is
 * allowed for any authenticated user (role check is opt-in, per-route).
 *
 * A user whose literal role is 'custom' isn't in any @Roles(...) list, so
 * they fall through to the route's @RequirePermission(...) (if any) and are
 * checked against their company's CustomRole instead.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private customRoles: CustomRolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (requiredRoles.includes(user.role)) return true;

    if (user.role === Role.CUSTOM) {
      const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (permission && (await this.customRoles.userHasPermission(user, permission))) {
        return true;
      }
    }

    throw new ForbiddenException(
      `Ce rôle (${user.role}) n'est pas autorisé pour cette action.`,
    );
  }
}
