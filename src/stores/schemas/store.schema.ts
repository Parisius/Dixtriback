import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoreDocument = Store & Document;

export enum StoreType {
  PHYSICAL = 'physical',
  VIRTUAL = 'virtual',
}

@Schema({ timestamps: true, strict: false, collection: 'stores' })
export class Store {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: StoreType })
  type: StoreType;

  @Prop({ type: Object, default: {} })
  address: Record<string, any>;

  @Prop({ type: String, default: null })
  regionId?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  managerId?: Types.ObjectId | null;

  @Prop({ default: true })
  isActive: boolean;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
