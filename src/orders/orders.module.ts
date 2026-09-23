import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { UnitsModule } from '../units/units.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ReceiptService } from './receipt.service';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Store.name, schema: StoreSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UnitsModule,
    ShiftsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ReceiptService],
  exports: [OrdersService],
})
export class OrdersModule {}
