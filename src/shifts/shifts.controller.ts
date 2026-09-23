import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Store & POS')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('shifts.open')
  @ApiOperation({
    summary: 'Ouvrir une caisse (début de service)',
    description:
      'Une seule caisse peut être ouverte à la fois par boutique (409 sinon). `openingFloat` est le ' +
      "fonds de caisse de départ compté avant la première vente.",
  })
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto) {
    return this.shiftsService.open(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les caisses (ouvertes et fermées)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftsService.findAll(user, page, limit, companyId, storeId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une caisse" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shiftsService.findById(user, id);
  }

  @Post(':id/close')
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('shifts.close')
  @ApiOperation({
    summary: 'Fermer une caisse (fin de service)',
    description:
      "`closingCash` est le montant compté physiquement dans le tiroir. `expectedCash` = fonds de " +
      "départ + ventes comptant − remboursements comptant sur la période de la caisse ; " +
      "`discrepancy` = closingCash − expectedCash (négatif = manquant).",
  })
  close(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CloseShiftDto) {
    return this.shiftsService.close(user, id, dto);
  }
}
