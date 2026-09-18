import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, strict: false, collection: 'products' })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  sku: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  category?: string;

  @Prop({ required: true })
  basePrice: number;

  @Prop({ type: [Object], default: [] })
  priceOverrides: Record<string, any>[];

  @Prop({ type: [String], default: [] })
  media: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
