import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

const RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10);

/**
 * One row per write action (POST/PUT/PATCH/DELETE) and per auth event.
 * Append-only: nothing in the API updates or deletes these rows; they expire
 * on their own after AUDIT_RETENTION_DAYS (default 365).
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  /** Company the action concerns. null = platform-level (visible to super admins only). */
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ type: String, default: null })
  actorId: string | null;

  @Prop({ type: String, default: null })
  actorRole: string | null;

  /** Email typed on auth attempts by someone who is not (yet) identified. */
  @Prop({ type: String, default: null })
  actorLabel: string | null;

  /** e.g. orders.create, shipments.receive, auth.login */
  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  resource: string;

  @Prop({ type: String, default: null })
  resourceId: string | null;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ required: true })
  statusCode: number;

  @Prop({ required: true })
  success: boolean;

  @Prop({ type: String, default: null })
  message: string | null;

  @Prop({ type: String, default: null })
  ip: string | null;

  @Prop({ type: String, default: null })
  userAgent: string | null;

  /** Request body with secrets redacted (see AuditService.sanitize). */
  @Prop({ type: Object, default: null })
  body: Record<string, any> | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });
