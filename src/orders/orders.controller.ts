import { Controller, Get, Header, Param, Post, Put, Body, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { ReceiptService } from './receipt.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Store & POS')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Post()
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('orders.create')
  @ApiOperation({
    summary: 'Créer une vente (comptant/carte/mobile money uniquement)',
    description:
      "Remise possible par ligne et/ou sur le total. `payments` accepte plusieurs entrées " +
      "(paiement fractionné) ; leur somme doit égaler le total après remises.",
  })
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
    @Query('cashierId') cashierId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(user, {
      page, limit, companyId, storeId, customerId, cashierId, status, from, to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une commande" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findById(user, id);
  }

  @Get(':id/receipt')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: "Reçu PDF téléchargeable d'une vente" })
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<StreamableFile> {
    const order = await this.ordersService.findById(user, id);
    const pdf = await this.receiptService.render(order);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="recu-${id}.pdf"`,
    });
  }

  @Put(':id')
  @Roles(Role.CASHIER, Role.SHOP_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('orders.update')
  @ApiOperation({ summary: 'Gérer les retours et remboursements' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(user, id, dto);
  }
}
