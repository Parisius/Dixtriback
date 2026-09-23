import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shift, ShiftDocument, ShiftStatus } from './schemas/shift.schema';
import { Order, OrderDocument, PaymentMethod } from '../orders/schemas/order.schema';
import { Store, StoreDocument } from '../stores/schemas/store.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { round2 } from '../common/utils/money';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    private tenancy: TenancyService,
  ) {}

  async open(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    const storeOk = await this.storeModel.exists({ _id: dto.storeId, companyId });
    if (!storeOk) {
      throw new BadRequestException("Boutique invalide : elle doit appartenir à l'entreprise.");
    }
    try {
      return await new this.shiftModel({
        companyId,
        storeId: dto.storeId,
        cashierId: user.userId,
        openingFloat: dto.openingFloat,
        status: ShiftStatus.OPEN,
      }).save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Une caisse est déjà ouverte pour cette boutique.');
      }
      throw err;
    }
  }

  async findAll(
    user: AuthUser,
    page = 1,
    limit = 20,
    companyId?: string,
    storeId?: string,
    status?: string,
  ) {
    const filter: Record<string, any> = {};
    if (storeId) filter.storeId = storeId;
    if (status) filter.status = status;
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));

    const [data, total] = await Promise.all([
      this.shiftModel.find(filter).skip((page - 1) * limit).limit(limit).sort('-createdAt').exec(),
      this.shiftModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const shift = await this.shiftModel.findById(id).exec();
    return this.tenancy.assertOwns(user, shift, 'Caisse introuvable');
  }

  /**
   * Closes a shift: counts what was actually in the drawer against what
   * should be there. expectedCash = openingFloat + cash sales - cash
   * refunds, both counted over [openedAt, now], at this store. A return
   * refunds cash exactly as it was originally paid (this codebase only
   * supports full-order returns, never partial).
   */
  async close(user: AuthUser, id: string, dto: Record<string, any>) {
    const shift = await this.findById(user, id);
    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException('Cette caisse est déjà fermée.');
    }

    const openedAt = (shift as any).createdAt as Date;
    const closedAt = new Date();
    const storeId = shift.storeId;

    const [cashInAgg, cashOutAgg, byMethodAgg, salesAgg, returnsAgg] = await Promise.all([
      this.orderModel.aggregate([
        { $match: { storeId, createdAt: { $gte: openedAt, $lte: closedAt } } },
        { $unwind: '$payments' },
        { $match: { 'payments.method': PaymentMethod.CASH } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      this.orderModel.aggregate([
        { $match: { storeId, returnedAt: { $gte: openedAt, $lte: closedAt } } },
        { $unwind: '$payments' },
        { $match: { 'payments.method': PaymentMethod.CASH } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      this.orderModel.aggregate([
        { $match: { storeId, createdAt: { $gte: openedAt, $lte: closedAt } } },
        { $unwind: '$payments' },
        { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' } } },
      ]),
      this.orderModel.aggregate([
        { $match: { storeId, createdAt: { $gte: openedAt, $lte: closedAt } } },
        {
          $group: {
            _id: null,
            ordersCount: { $sum: 1 },
            grossSales: { $sum: '$total' },
            discountGiven: { $sum: '$discountTotal' },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: { storeId, returnedAt: { $gte: openedAt, $lte: closedAt } } },
        { $group: { _id: null, returnsCount: { $sum: 1 }, returnsTotal: { $sum: '$total' } } },
      ]),
    ]);

    const cashIn = cashInAgg[0]?.total ?? 0;
    const cashOut = cashOutAgg[0]?.total ?? 0;
    const expectedCash = round2(shift.openingFloat + cashIn - cashOut);
    const closingCash = round2(dto.closingCash);

    shift.status = ShiftStatus.CLOSED;
    shift.closedAt = closedAt;
    shift.closedBy = user.userId;
    shift.closingCash = closingCash;
    shift.expectedCash = expectedCash;
    shift.discrepancy = round2(closingCash - expectedCash);
    if (dto.note) shift.note = dto.note;
    shift.summary = {
      byPaymentMethod: Object.fromEntries(
        byMethodAgg.map((m: any) => [m._id, round2(m.total)]),
      ),
      ordersCount: salesAgg[0]?.ordersCount ?? 0,
      grossSales: round2(salesAgg[0]?.grossSales ?? 0),
      discountGiven: round2(salesAgg[0]?.discountGiven ?? 0),
      returnsCount: returnsAgg[0]?.returnsCount ?? 0,
      returnsTotal: round2(returnsAgg[0]?.returnsTotal ?? 0),
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
    };
    return shift.save();
  }

  /** Used by OrdersService at checkout: the open shift's id for this store, if any. */
  async openShiftIdFor(companyId: string, storeId: string): Promise<string | null> {
    const shift = await this.shiftModel
      .findOne({ companyId, storeId, status: ShiftStatus.OPEN })
      .select('_id')
      .lean()
      .exec();
    return shift ? String(shift._id) : null;
  }
}
