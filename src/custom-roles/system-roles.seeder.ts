import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomRole, CustomRoleDocument } from './schemas/custom-role.schema';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { Role } from '../common/constants/roles.enum';

/**
 * At startup, scans every controller method for @Roles(...) paired with
 * @RequirePermission(...) and derives, for each FIXED role, the set of
 * permissions it holds — then upserts one generic Role document
 * (isSystem: true, companyId: null) per Role enum value (except 'custom',
 * which has no fixed permission set of its own: it looks one up instead).
 *
 * This is the single source of truth for what appears in GET /v1/roles as
 * "generic" roles — nothing here is hand-maintained, so it cannot drift from
 * what RolesGuard actually enforces. Runs on every boot (idempotent upsert),
 * so a permission added or removed from a route is reflected automatically.
 */
@Injectable()
export class SystemRolesSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemRolesSeeder.name);

  constructor(
    private discoveryService: DiscoveryService,
    private metadataScanner: MetadataScanner,
    private reflector: Reflector,
    @InjectModel(CustomRole.name) private roleModel: Model<CustomRoleDocument>,
  ) {}

  async onApplicationBootstrap() {
    const byRole = new Map<string, Set<string>>();
    for (const role of Object.values(Role)) {
      if (role !== Role.CUSTOM) byRole.set(role, new Set());
    }

    for (const wrapper of this.discoveryService.getControllers()) {
      const instance: any = wrapper.instance;
      if (!instance || !Object.getPrototypeOf(instance)) continue;
      const prototype = Object.getPrototypeOf(instance);
      this.metadataScanner.getAllMethodNames(prototype).forEach((methodName) => {
        const handler = prototype[methodName];
        const roles = this.reflector.get<Role[] | undefined>(ROLES_KEY, handler);
        const permission = this.reflector.get<string | undefined>(PERMISSION_KEY, handler);
        if (!roles || !permission) return;
        for (const role of roles) {
          if (role === Role.CUSTOM) continue;
          if (!byRole.has(role)) byRole.set(role, new Set());
          byRole.get(role)!.add(permission);
        }
      });
    }

    await Promise.all(
      [...byRole.entries()].map(([role, permissions]) =>
        this.roleModel
          .updateOne(
            { companyId: null, isSystem: true, name: role },
            {
              $set: {
                companyId: null,
                isSystem: true,
                name: role,
                permissions: [...permissions].sort(),
                isActive: true,
              },
            },
            { upsert: true },
          )
          .exec(),
      ),
    );
    this.logger.log(`Synced ${byRole.size} generic roles from route metadata.`);
  }
}
