import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UnitDocument = Unit & Document;

export enum UnitOwnerType {
  WAREHOUSE = 'warehouse',
  FIELD_AGENT = 'field_agent',
  STORE = 'store',
  ENTERPRISE = 'enterprise',
  CUSTOMER = 'customer',
  SOLD = 'sold',
}

export enum UnitStatus {
  IN_STOCK = 'in_stock',
  IN_TRANSIT = 'in_transit',
  SOLD = 'sold',
  RETURNED = 'returned',
  DAMAGED = 'damaged',
  WRITTEN_OFF = 'written_off',
}

/**
 * One document per physical unit — the core of unit-level traceability.
 * `history` accumulates every ownership transfer (see UnitsService.transfer),
 * giving a full Supplier -> Shipment -> Warehouse -> ... -> Sale trace-back
 * without needing to join across collections.
 */
@Schema({ timestamps: true, strict: false, collection: 'units' })
export class Unit {
  @Prop({ required: true, unique: true, index: true })
  serial: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Shipment', required: true })
  shipmentId: Types.ObjectId;

  @Prop({ required: true })
  landedUnitCost: number;

  @Prop({ required: true, enum: UnitOwnerType })
  ownerType: UnitOwnerType;

  @Prop({ required: true })
  ownerId: string;

  @Prop({ required: true, enum: UnitStatus, default: UnitStatus.IN_STOCK })
  status: UnitStatus;

  @Prop({ type: [Object], default: [] })
  history: Record<string, any>[];
}

export const UnitSchema = SchemaFactory.createForClass(Unit);
