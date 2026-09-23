import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderChannel {
  MARKETPLACE = 'marketplace',
  FIELD_AGENT = 'field_agent',
  STORE = 'store',
  ENTERPRISE = 'enterprise',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  CREDIT = 'credit',
  INSTALLMENT = 'installment',
}

export enum DiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

export enum OrderStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  FULFILLED = 'fulfilled',
  DELIVERED = 'delivered',
  CLOSED = 'closed',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, strict: false, collection: 'orders' })
export class Order {
  @Prop({ required: true, enum: OrderChannel })
  channel: OrderChannel;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Store', default: null, index: true })
  storeId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Customer', default: null })
  customerId?: Types.ObjectId | null;

  /** The staff member who rang up the sale — set from the authenticated caller at checkout. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  cashierId?: Types.ObjectId | null;

  /** The open shift this sale's cash was counted against, if the store had one open. */
  @Prop({ type: String, default: null })
  shiftId?: string | null;

  /** Each line: { productId, quantity, unitPrice, unitIds: [...],
   * discount?: { type, value }, discountAmount } — discountAmount is the
   * computed currency amount actually taken off that line. */
  @Prop({ type: [Object], default: [] })
  lines: Record<string, any>[];

  /** Sum of quantity * unitPrice across all lines, before any discount. */
  @Prop({ required: true })
  subtotal: number;

  /** Order-level discount as entered (on top of any per-line discounts). */
  @Prop({ type: Object, default: null })
  discount?: { type: DiscountType; value: number } | null;

  /** Line discounts + the order-level discount, in currency — for receipts/reports. */
  @Prop({ default: 0 })
  discountTotal: number;

  /** subtotal - discountTotal — what the customer actually owes. */
  @Prop({ required: true })
  total: number;

  /** How the total was actually paid; more than one entry = a split payment.
   * Each entry: { method, amount }. Sum of amounts === total. */
  @Prop({ type: [Object], required: true })
  payments: Array<{ method: PaymentMethod; amount: number }>;

  @Prop({ enum: OrderStatus, default: OrderStatus.CONFIRMED })
  status: OrderStatus;

  @Prop({ type: String, default: null })
  parentOrderId?: string | null;

  /** Set the moment status transitions to 'returned' — the cash-register
   * reconciliation (see ShiftsService) uses this, not updatedAt, to know
   * exactly when the refund happened. */
  @Prop({ type: Date, default: null })
  returnedAt?: Date | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ storeId: 1, createdAt: 1 });
OrderSchema.index({ storeId: 1, returnedAt: 1 });
