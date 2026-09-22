import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions';

export const PERMISSION_KEY = 'permission';

/**
 * Companion to @Roles(...) on the same route: what a `role: "custom"` user
 * needs in their CustomRole.permissions to pass, when their literal role
 * isn't in the @Roles(...) list. Fixed roles never consult this — @Roles
 * alone decides for them, unchanged.
 */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
