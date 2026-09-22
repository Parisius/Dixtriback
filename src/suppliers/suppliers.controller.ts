import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @RequirePermission('suppliers.create')
  @ApiOperation({ summary: 'Enregistrer un fournisseur' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les fournisseurs' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.suppliersService.findAll(user, page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un fournisseur par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.suppliersService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @RequirePermission('suppliers.update')
  @ApiOperation({ summary: 'Mettre à jour un fournisseur' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('suppliers.delete')
  @ApiOperation({ summary: 'Désactiver un fournisseur' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.suppliersService.remove(user, id);
  }
}
