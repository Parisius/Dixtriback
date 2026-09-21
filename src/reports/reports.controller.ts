import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reporting')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles(Role.DIRECTOR, Role.FINANCIAL_MANAGER, Role.SALES_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Ventes par boutique, produit, ou caissier' })
  sales(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: 'store' | 'product' | 'cashier' | 'company',
  ) {
    return this.reportsService.sales(user, { companyId, from, to, groupBy });
  }

  @Get('inventory')
  @Roles(Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Rotation des stocks et ruptures' })
  inventory(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId?: string, @Query('companyId') companyId?: string) {
    return this.reportsService.inventory(user, { warehouseId, companyId });
  }

  @Get('margin')
  @Roles(Role.FINANCIAL_MANAGER, Role.DIRECTOR, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Marges par produit, coût de revient à l\'unité' })
  margin(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.margin(user, { companyId, from, to });
  }

  @Get('credit-aging')
  @Roles(Role.FINANCIAL_MANAGER, Role.ACCOUNTANT, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Ancienneté des créances (si crédit activé)' })
  creditAging() {
    return this.reportsService.creditAging();
  }
}
