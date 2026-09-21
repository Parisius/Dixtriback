import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';
import { Region, RegionSchema } from './schemas/region.schema';
import { Zone, ZoneSchema } from './schemas/zone.schema';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Region.name, schema: RegionSchema },
      { name: Zone.name, schema: ZoneSchema },
    ]),
  ],
  controllers: [RegionsController, ZonesController],
  providers: [RegionsService, ZonesService],
  exports: [RegionsService, ZonesService],
})
export class RegionsModule {}
