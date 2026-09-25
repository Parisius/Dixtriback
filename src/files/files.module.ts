import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileAsset, FileAssetSchema } from './schemas/file-asset.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileAsset.name, schema: FileAssetSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Store.name, schema: StoreSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
