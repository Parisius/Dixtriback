import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto, ApprovePurchaseOrderDto } from './dto/purchase-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Créer un bon de commande' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les bons de commande' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.purchaseOrdersService.findAll(page, limit, companyId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un bon de commande' })
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findById(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un bon de commande' })
  update(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCIAL_MANAGER, Role.DIRECTOR)
  @ApiOperation({ summary: 'Approuver un bon de commande' })
  approve(@Param('id') id: string, @Body() dto: ApprovePurchaseOrderDto) {
    return this.purchaseOrdersService.approve(id, dto?.approvedBy);
  }
}
