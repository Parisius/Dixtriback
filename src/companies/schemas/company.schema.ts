import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true, strict: false, collection: 'companies' })
export class Company {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  legalName?: string;

  @Prop({ type: [String], default: [] })
  countries: string[];

  @Prop({ default: 'XOF' })
  currency: string;

  @Prop({ type: Object, default: {} })
  creditPolicy: Record<string, any>;

  @Prop({ type: Object, default: {} })
  branding: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
