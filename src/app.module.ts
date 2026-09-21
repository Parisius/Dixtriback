import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { TenancyModule } from './tenancy/tenancy.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';
import { RegionsModule } from './regions/regions.module';
import { StoresModule } from './stores/stores.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { SegmentsModule } from './segments/segments.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    TenancyModule,
    AuditModule,

    // Phase 1 — Admin Dashboard, in build order (Section: Feuille de Route)
    AuthModule,
    UsersModule,
    CompaniesModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ShipmentsModule,
    WarehousesModule,
    UnitsModule,
    ProductsModule,
    RegionsModule,
    StoresModule,
    OrdersModule,
    CustomersModule,
    SegmentsModule,
    ReportsModule,
  ],
  providers: [
    // Every route requires a valid JWT unless marked @Public(); role checks
    // are then applied per-route via @Roles(...). Order matters: auth first.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
