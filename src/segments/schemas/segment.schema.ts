import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SegmentDocument = Segment & Document;

@Schema({ timestamps: true, strict: false, collection: 'segments' })
export class Segment {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  /** Ex: { minSpend, minOrders, region, tag } — evaluated by SegmentsService.recompute */
  @Prop({ type: Object, required: true })
  rules: Record<string, any>;

  @Prop({ default: 0 })
  customerCount: number;

  @Prop({ type: Date, default: null })
  lastComputedAt?: Date | null;
}

export const SegmentSchema = SchemaFactory.createForClass(Segment);
