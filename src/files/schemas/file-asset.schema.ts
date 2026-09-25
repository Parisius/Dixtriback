import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FileAssetDocument = FileAsset & Document;

export enum OwnerType {
  PRODUCT = 'product',
  STORE = 'store',
  COMPANY = 'company',
  USER = 'user',
}

/**
 * Metadata for one uploaded file. The bytes live in the object store under
 * `key`; this document is what tenancy, ownership and the audit trail hang off.
 */
@Schema({ timestamps: true, strict: false, collection: 'files' })
export class FileAsset {
  /** null only for a company-less owner (a super admin's own avatar): then only the uploader may see it. */
  @Prop({ type: String, default: null, index: true })
  companyId: string | null;

  /** Object-store key — internal, never returned by the API. */
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  originalName: string;

  /** The type detected from the bytes, not the one the client claimed. */
  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true, enum: ['image', 'document'] })
  kind: 'image' | 'document';

  @Prop({ type: String, enum: [...Object.values(OwnerType), null], default: null })
  ownerType: OwnerType | null;

  @Prop({ type: String, default: null })
  ownerId: string | null;

  /** Free label, e.g. "logo", "avatar", "gallery", "invoice". */
  @Prop({ type: String, default: null })
  purpose: string | null;

  /** Only product images are public (served without login). */
  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: String, required: true })
  uploadedBy: string;
}

export const FileAssetSchema = SchemaFactory.createForClass(FileAsset);
FileAssetSchema.index({ ownerType: 1, ownerId: 1 });
