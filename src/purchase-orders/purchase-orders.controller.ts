import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto, ApprovePurchaseOrderDto } from './dto/purchase-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @RequirePermission('purchase-orders.create')
  @ApiOperation({ summary: 'Créer un bon de commande' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les bons de commande' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.purchaseOrdersService.findAll(user, page, limit, companyId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un bon de commande' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchaseOrdersService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @RequirePermission('purchase-orders.update')
  @ApiOperation({ summary: 'Mettre à jour un bon de commande' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.purchaseOrdersService.update(user, id, dto);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCIAL_MANAGER, Role.DIRECTOR)
  @RequirePermission('purchase-orders.approve')
  @ApiOperation({ summary: 'Approuver un bon de commande' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApprovePurchaseOrderDto) {
    return this.purchaseOrdersService.approve(user, id, dto?.approvedBy);
  }
}
