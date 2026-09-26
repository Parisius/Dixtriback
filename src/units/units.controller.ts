import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { UnitTransferDto } from './dto/unit-transfer.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Role } from '../common/constants/roles.enum';
import { UnitStatusDto } from './dto/unit-status.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les unités sérialisées' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('ownerType') ownerType?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.unitsService.findAll(user, { page, limit, ownerType, status, companyId });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une unité" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.unitsService.findById(user, id);
  }

  @Post(':id/transfer')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR)
  @RequirePermission('units.transfer')
  @ApiOperation({
    summary: "Transférer une unité en stock vers un entrepôt, une boutique ou un agent",
    description:
      "Réservé aux rôles d'entrepôt. Seule une unité `in_stock` peut être transférée ; la destination doit " +
      "appartenir à la même entreprise. Les ventes et retours passent par /v1/orders, pas par ici.",
  })
  transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UnitTransferDto) {
    return this.unitsService.transfer(user, id, dto.toOwnerType, dto.toOwnerId, dto.note);
  }

  @Post(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR)
  @RequirePermission('units.status')
  @ApiOperation({
    summary: 'Déclarer une unité endommagée / radiée (ou la remettre en stock)',
    description:
      "in_stock → damaged | written_off ; damaged → written_off | in_stock. Motif obligatoire, tracé dans l'historique " +
      "de l'unité et dans le journal d'activité. L'unité sort du stock vendable mais reste rattachée à son emplacement.",
  })
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UnitStatusDto) {
    return this.unitsService.changeStatus(user, id, dto.status, dto.reason);
  }

  @Get(':serial/trace')
  @ApiOperation({ summary: "Traçabilité complète d'une unité par son numéro de série" })
  trace(@CurrentUser() user: AuthUser, @Param('serial') serial: string) {
    return this.unitsService.trace(user, serial);
  }
}
