import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('Company')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Créer et configurer l'entreprise" })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.companiesService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister mes entreprises',
    description:
      "Super admin : toutes les entreprises. Autres rôles : leur propre entreprise.",
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.companiesService.findAll(user, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une entreprise par id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une entreprise' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Désactiver une entreprise' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.remove(user, id);
  }
}
