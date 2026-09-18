import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto, TransferStockDto } from './dto/warehouse.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('Warehouse')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer un entrepôt (national/import ou régional)' })
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les entrepôts' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('tier') tier?: string,
  ) {
    return this.warehousesService.findAll(page, limit, companyId, tier);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un entrepôt par id' })
  findOne(@Param('id') id: string) {
    return this.warehousesService.findById(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un entrepôt' })
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Post(':id/transfers')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR)
  @ApiOperation({
    summary: 'Demander/exécuter un transfert de stock depuis cet entrepôt',
    description:
      'Country → Regional, Regional → Field Agent, Regional → Store. Déplace des unités sérialisées précises.',
  })
  transfer(@Param('id') id: string, @Body() dto: TransferStockDto) {
    return this.warehousesService.transferStock(id, dto);
  }
}
