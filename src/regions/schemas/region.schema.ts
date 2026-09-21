import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RegionDocument = Region & Document;

/**
 * A geographic/operational region of ONE company (e.g. "Littoral"). Regional
 * warehouses, stores and users reference it through `regionId`.
 * `strict: false` like every schema here: extra fields are kept.
 */
@Schema({ timestamps: true, strict: false, collection: 'regions' })
export class Region {
  // Stored as a plain string like every other companyId in this codebase.
  @Prop({ type: String, required: true, index: true })
  companyId: string;

  @Prop({ required: true, trim: true })
  name: string;

  /** Optional short code, e.g. "LIT". */
  @Prop({ trim: true })
  code?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const RegionSchema = SchemaFactory.createForClass(Region);
// A company cannot have two regions with the same name.
RegionSchema.index({ companyId: 1, name: 1 }, { unique: true });
