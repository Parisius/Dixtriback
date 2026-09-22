import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('customers.create')
  @ApiOperation({ summary: 'Créer une fiche client' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister / rechercher les clients' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
  ) {
    return this.customersService.findAll(user, { page, limit, companyId, q });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une fiche client" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customersService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SHOP_MANAGER, Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('customers.update')
  @ApiOperation({ summary: 'Mettre à jour une fiche client' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(user, id, dto);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: "Historique d'achat complet d'un client (vue admin)" })
  orders(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.orderHistory(user, id, page, limit);
  }
}
