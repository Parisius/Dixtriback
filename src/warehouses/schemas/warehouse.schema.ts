import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WarehouseDocument = Warehouse & Document;

export enum WarehouseTier {
  COUNTRY_IMPORT = 'country_import',
  REGIONAL = 'regional',
}

@Schema({ timestamps: true, strict: false, collection: 'warehouses' })
export class Warehouse {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: WarehouseTier })
  tier: WarehouseTier;

  @Prop({ type: String, default: null })
  regionId?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  managerId?: Types.ObjectId | null;

  @Prop({ type: Object, default: {} })
  address: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
