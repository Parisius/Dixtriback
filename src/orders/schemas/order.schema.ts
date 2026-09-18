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

  @Prop({ type: Types.ObjectId, ref: 'Store', default: null })
  storeId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Customer', default: null })
  customerId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  cashierId?: Types.ObjectId | null;

  /** Each line: { productId, quantity, unitPrice, unitIds: [...] } */
  @Prop({ type: [Object], default: [] })
  lines: Record<string, any>[];

  @Prop({ required: true })
  total: number;

  @Prop({ required: true, enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Prop({ enum: OrderStatus, default: OrderStatus.CONFIRMED })
  status: OrderStatus;

  @Prop({ type: String, default: null })
  parentOrderId?: string | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
