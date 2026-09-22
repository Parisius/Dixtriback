import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomRoleDocument = CustomRole & Document;

/**
 * A role a company defines for itself: a name plus a set of permissions
 * (see src/common/constants/permissions.ts). A user is placed on one via
 * User.role = 'custom' + User.customRoleId.
 */
@Schema({ timestamps: true, strict: false, collection: 'custom_roles' })
export class CustomRole {
  @Prop({ type: String, required: true, index: true })
  companyId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const CustomRoleSchema = SchemaFactory.createForClass(CustomRole);
// A company cannot have two custom roles with the same name.
CustomRoleSchema.index({ companyId: 1, name: 1 }, { unique: true });
