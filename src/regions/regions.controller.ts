import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegionsService } from './regions.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Region')
@ApiBearerAuth()
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Créer une région',
    description:
      "Les régions appartiennent à une entreprise. `regionId` sur une boutique, un entrepôt ou un utilisateur doit référencer l'une d'elles.",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRegionDto) {
    return this.regionsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les régions' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.regionsService.findAll(user, page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une région par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.regionsService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une région' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver une région' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.regionsService.remove(user, id);
  }
}
