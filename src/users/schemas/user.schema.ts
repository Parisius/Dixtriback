import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../common/constants/roles.enum';

export type UserDocument = User & Document;

/**
 * `strict: false` is what makes the "additional fields allowed" rule work
 * at the persistence layer: any property present on the object passed to
 * the model — beyond the ones declared with @Prop() below — is still saved
 * on the document instead of being silently dropped by Mongoose. Every
 * schema in this project repeats this option for the same reason.
 */
@Schema({ timestamps: true, strict: false, collection: 'users' })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Company', default: null })
  companyId: Types.ObjectId | null;

  @Prop({ required: true, enum: Role })
  role: Role;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, lowercase: true, unique: true, sparse: true })
  email?: string;

  @Prop({ trim: true, unique: true, sparse: true })
  phone?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: Types.ObjectId, ref: 'Store', default: null })
  storeId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  regionId?: string | null;

  @Prop({ type: String, default: null })
  enterpriseId?: string | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ default: false })
  emailVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
