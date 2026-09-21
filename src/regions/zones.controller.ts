import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Region')
@ApiBearerAuth()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Créer une zone dans une région',
    description:
      "Une zone est une subdivision d'UNE région (`regionId`) ; l'entreprise est celle de la région. " +
      'Une région peut avoir plusieurs zones (nom unique par région).',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateZoneDto) {
    return this.zonesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les zones (filtrable par région)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.zonesService.findAll(user, page, limit, companyId, regionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une zone par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.zonesService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une zone (la région parente ne change pas)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver une zone' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.zonesService.remove(user, id);
  }
}
