import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to the given roles. Combine with RolesGuard.
 * Omitting this decorator means "any authenticated user" — it does not
 * make the route public (use @Public() for that).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
