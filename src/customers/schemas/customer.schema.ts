import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true, strict: false, collection: 'customers' })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Segment', default: [] })
  segmentIds: Types.ObjectId[];

  @Prop({ default: 0 })
  totalSpend: number;

  @Prop({ default: 0 })
  orderCount: number;

  @Prop({ type: Date, default: null })
  lastPurchaseAt?: Date | null;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
