import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegionsModule } from '../regions/regions.module';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [
    RegionsModule,
    MongooseModule.forFeature([{ name: Warehouse.name, schema: WarehouseSchema }]),
    UnitsModule,
  ],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
