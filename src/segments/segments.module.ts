import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';
import { Segment, SegmentSchema } from './schemas/segment.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Segment.name, schema: SegmentSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
