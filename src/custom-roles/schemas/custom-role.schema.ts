import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomRoleDocument = CustomRole & Document;

/**
 * A role — either:
 *  - generic (isSystem: true, companyId: null): one of the fixed Role enum
 *    values (admin, cashier, ...). Synced automatically at startup from the
 *    @Roles()/@RequirePermission() pairs on every route — see
 *    SystemRolesSeeder — never created/edited through the API.
 *  - a company's own (isSystem: false): a name plus a set of permissions
 *    (see src/common/constants/permissions.ts). A user is placed on one via
 *    User.role = 'custom' + User.customRoleId.
 */
@Schema({ timestamps: true, strict: false, collection: 'roles' })
export class CustomRole {
  @Prop({ type: String, default: null, index: true })
  companyId: string | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystem: boolean;
}

export const CustomRoleSchema = SchemaFactory.createForClass(CustomRole);
// A company cannot have two custom roles with the same name.
CustomRoleSchema.index({ companyId: 1, name: 1 }, { unique: true });
