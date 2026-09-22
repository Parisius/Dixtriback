import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Store & POS')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('orders.create')
  @ApiOperation({ summary: 'Créer une vente (comptant/carte/mobile money uniquement)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les commandes' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('storeId') storeId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.ordersService.findAll(user, { page, limit, companyId, storeId, customerId });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une commande" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('orders.update')
  @ApiOperation({ summary: 'Gérer les retours et remboursements' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(user, id, dto);
  }
}
