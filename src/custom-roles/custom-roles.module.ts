import { DiscoveryModule } from '@nestjs/core';
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomRolesService } from './custom-roles.service';
import { CustomRolesController } from './custom-roles.controller';
import { CustomRole, CustomRoleSchema } from './schemas/custom-role.schema';
import { SystemRolesSeeder } from './system-roles.seeder';

/**
 * @Global: RolesGuard (registered as APP_GUARD in AppModule's own providers)
 * injects CustomRolesService directly, the same way TenancyModule is global
 * for TenancyService.
 */
@Global()
@Module({
  imports: [
    DiscoveryModule,
    MongooseModule.forFeature([{ name: CustomRole.name, schema: CustomRoleSchema }]),
  ],
  controllers: [CustomRolesController],
  providers: [CustomRolesService, SystemRolesSeeder],
  exports: [CustomRolesService],
})
export class CustomRolesModule {}
