import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupplierDocument = Supplier & Document;

@Schema({ timestamps: true, strict: false, collection: 'suppliers' })
export class Supplier {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  country?: string;

  @Prop()
  leadTimeDays?: number;

  @Prop()
  paymentTerms?: string;

  @Prop({ type: Object, default: {} })
  contact: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
