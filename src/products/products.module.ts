import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { FileAsset, FileAssetSchema } from '../files/schemas/file-asset.schema';
import { UnitsModule } from '../units/units.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: FileAsset.name, schema: FileAssetSchema },
    ]),
    UnitsModule,
    FilesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
