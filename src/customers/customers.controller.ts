import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer une fiche client' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister / rechercher les clients' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
  ) {
    return this.customersService.findAll({ page, limit, companyId, q });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une fiche client" })
  findOne(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Put(':id')
  @Roles(Role.SHOP_MANAGER, Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une fiche client' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: "Historique d'achat complet d'un client (vue admin)" })
  orders(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.orderHistory(id, page, limit);
  }
}
