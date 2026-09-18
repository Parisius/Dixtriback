import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('Store & POS')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer une vente (comptant/carte/mobile money uniquement)' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les commandes' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('storeId') storeId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.ordersService.findAll({ page, limit, companyId, storeId, customerId });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une commande" })
  findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Put(':id')
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Gérer les retours et remboursements' })
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }
}
