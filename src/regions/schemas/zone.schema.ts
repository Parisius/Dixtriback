import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ZoneDocument = Zone & Document;

/**
 * A subdivision of a Region (e.g. region "Littoral" -> zones "Cotonou Centre",
 * "Akpakpa"). A zone belongs to exactly one region and, through it, one
 * company: `companyId` is copied from the region so tenant checks stay uniform.
 */
@Schema({ timestamps: true, strict: false, collection: 'zones' })
export class Zone {
  @Prop({ type: String, required: true, index: true })
  companyId: string;

  @Prop({ type: String, required: true, index: true })
  regionId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  code?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);
// A region cannot have two zones with the same name.
ZoneSchema.index({ regionId: 1, name: 1 }, { unique: true });
