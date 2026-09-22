import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomRolesService } from './custom-roles.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto } from './dto/custom-role.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Role } from '../common/constants/roles.enum';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class CustomRolesController {
  constructor(private readonly rolesService: CustomRolesService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Catalogue des permissions disponibles pour un rôle personnalisé' })
  permissions() {
    return PERMISSIONS;
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('roles.manage')
  @ApiOperation({
    summary: 'Créer un rôle personnalisé',
    description:
      "Un rôle appartient à une entreprise : nom + liste de permissions (GET /v1/roles/permissions). " +
      "Affectez-le à un utilisateur avec role=\"custom\" et customRoleId=<id> (POST/PUT /v1/users).",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomRoleDto) {
    return this.rolesService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les rôles',
    description:
      "Retourne toujours les rôles génériques (isSystem: true — admin, cashier, etc., synchronisés " +
      "automatiquement depuis le code, en lecture seule) ET les rôles personnalisés de l'entreprise " +
      "(du super admin : toutes les siennes). `companyId` ne filtre que les rôles personnalisés.",
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.rolesService.findAll(user, page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un rôle (générique ou personnalisé)" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rolesService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('roles.manage')
  @ApiOperation({ summary: 'Mettre à jour un rôle personnalisé' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomRoleDto) {
    return this.rolesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('roles.manage')
  @ApiOperation({
    summary: 'Désactiver un rôle personnalisé',
    description: "Les utilisateurs qui l'utilisent perdent immédiatement les permissions associées.",
  })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rolesService.remove(user, id);
  }
}
