import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Store')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('stores.create')
  @ApiOperation({ summary: 'Créer une boutique physique/virtuelle' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStoreDto) {
    return this.storesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les boutiques' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.storesService.findAll(user, page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une boutique par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storesService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SHOP_MANAGER)
  @RequirePermission('stores.update')
  @ApiOperation({ summary: 'Mettre à jour une boutique' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('stores.delete')
  @ApiOperation({ summary: 'Désactiver une boutique' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storesService.remove(user, id);
  }

  @Get(':id/inventory')
  @ApiOperation({
    summary: 'Stock de cette boutique : quantité par produit, par statut',
    description:
      'Pour chaque produit détenu par cette boutique : la quantité totale et sa répartition par statut ' +
      '(in_stock, sold, damaged, written_off, in_transit, returned) — toujours un sous-ensemble de ce ' +
      "qu'un entrepôt lui a transféré. Le stock global toutes entreprises reste sur `GET /v1/reports/inventory`.",
  })
  inventory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storesService.inventory(user, id);
  }
}
