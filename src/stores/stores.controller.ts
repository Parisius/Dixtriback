import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Store')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
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
  @ApiOperation({ summary: 'Mettre à jour une boutique' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver une boutique' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.storesService.remove(user, id);
  }
}
