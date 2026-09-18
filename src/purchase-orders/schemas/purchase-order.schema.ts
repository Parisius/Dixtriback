import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PurchaseOrderDocument = PurchaseOrder & Document;

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, strict: false, collection: 'purchase_orders' })
export class PurchaseOrder {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true })
  supplierId: Types.ObjectId;

  @Prop({ enum: PurchaseOrderStatus, default: PurchaseOrderStatus.DRAFT })
  status: PurchaseOrderStatus;

  @Prop({ default: 'XOF' })
  currency: string;

  @Prop()
  incoterms?: string;

  /** Each line: { productId, quantity, unitCost } (+ any extra fields) */
  @Prop({ type: [Object], default: [] })
  lines: Record<string, any>[];

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy?: Types.ObjectId | null;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
