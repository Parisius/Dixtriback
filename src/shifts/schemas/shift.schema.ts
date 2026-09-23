import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShiftDocument = Shift & Document;

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/**
 * A cash-register session for one store: opened with a starting float,
 * closed with a physically counted cash amount. Sales aren't linked to a
 * shift by id — the reconciliation at close time queries orders of that
 * store created (or returned) within [openedAt, closedAt] instead, which is
 * simpler and remains correct even for a shift that was never referenced by
 * any order. Only one shift may be open per store at a time (enforced by
 * the partial unique index below).
 */
@Schema({ timestamps: true, strict: false, collection: 'shifts' })
export class Shift {
  @Prop({ type: String, required: true, index: true })
  companyId: string;

  @Prop({ type: String, required: true, index: true })
  storeId: string;

  /** Who opened it. */
  @Prop({ type: String, required: true })
  cashierId: string;

  @Prop({ required: true, min: 0 })
  openingFloat: number;

  @Prop({ required: true, enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @Prop({ type: Date, default: null })
  closedAt?: Date | null;

  /** Who closed it — not necessarily the same person who opened it. */
  @Prop({ type: String, default: null })
  closedBy?: string | null;

  @Prop({ type: Number, default: null })
  closingCash?: number | null;

  /** openingFloat + cash sales - cash refunds during the shift's window. */
  @Prop({ type: Number, default: null })
  expectedCash?: number | null;

  /** closingCash - expectedCash. Positive = more cash than expected, negative = a shortfall. */
  @Prop({ type: Number, default: null })
  discrepancy?: number | null;

  /** Breakdown computed at close time: totals by payment method, discounts
   * given, order/return counts — see ShiftsService.close. */
  @Prop({ type: Object, default: null })
  summary?: Record<string, any> | null;

  @Prop({ type: String, default: null })
  note?: string | null;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);
// Only one open shift per store at a time.
ShiftSchema.index(
  { storeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: ShiftStatus.OPEN } },
);
