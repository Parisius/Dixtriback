import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShipmentDocument = Shipment & Document;

export enum ShipmentType {
  CONTAINER = 'container',
  CARGO = 'cargo',
  BALE = 'bale',
}

export enum ShipmentStatus {
  ORDERED = 'ordered',
  IN_TRANSIT = 'in_transit',
  CUSTOMS = 'customs',
  ARRIVED = 'arrived',
  RECEIVED = 'received',
  INSPECTED = 'inspected',
  PUT_AWAY = 'put_away',
}

@Schema({ timestamps: true, strict: false, collection: 'shipments' })
export class Shipment {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PurchaseOrder', default: null })
  purchaseOrderId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true })
  supplierId: Types.ObjectId;

  @Prop({ required: true, enum: ShipmentType })
  type: ShipmentType;

  /** Each manifest line: { productId, quantity, unitCost } (+ any extra fields) */
  @Prop({ type: [Object], default: [] })
  manifest: Record<string, any>[];

  @Prop({
    type: Object,
    default: { freight: 0, duties: 0, handling: 0 },
  })
  landedCosts: { freight: number; duties: number; handling: number };

  @Prop({ required: true, enum: ShipmentStatus, default: ShipmentStatus.ORDERED })
  status: ShipmentStatus;

  @Prop({ type: Types.ObjectId, ref: 'Warehouse', required: true })
  destinationWarehouseId: Types.ObjectId;
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);
