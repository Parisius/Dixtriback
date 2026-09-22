import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto, TransferStockDto } from './dto/warehouse.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Warehouse')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('warehouses.create')
  @ApiOperation({ summary: 'Créer un entrepôt (national/import ou régional)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les entrepôts' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('tier') tier?: string,
  ) {
    return this.warehousesService.findAll(user, page, limit, companyId, tier);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un entrepôt par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.warehousesService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @RequirePermission('warehouses.update')
  @ApiOperation({ summary: 'Mettre à jour un entrepôt' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(user, id, dto);
  }

  @Post(':id/transfers')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR)
  @RequirePermission('warehouses.transfer')
  @ApiOperation({
    summary: 'Demander/exécuter un transfert de stock depuis cet entrepôt',
    description:
      'Country → Regional, Regional → Field Agent, Regional → Store. Déplace des unités sérialisées précises.',
  })
  transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransferStockDto) {
    return this.warehousesService.transferStock(user, id, dto);
  }
}
