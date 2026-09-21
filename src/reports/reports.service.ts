import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Unit, UnitDocument, UnitStatus } from '../units/schemas/unit.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Unit.name) private unitModel: Model<UnitDocument>,
    private tenancy: TenancyService,
  ) {}

  /** Sales by company, store, product, or cashier over an optional date range. */
  async sales(user: AuthUser, params: {
    companyId?: string;
    from?: string;
    to?: string;
    groupBy?: 'store' | 'product' | 'cashier' | 'company';
  }) {
    const match: Record<string, any> = await this.tenancy.companyMatch(user, params.companyId);
    if (params.from || params.to) {
      match.createdAt = {};
      if (params.from) match.createdAt.$gte = new Date(params.from);
      if (params.to) match.createdAt.$lte = new Date(params.to);
    }

    const groupBy = params.groupBy || 'store';

    if (groupBy === 'product') {
      const rows = await this.orderModel.aggregate([
        { $match: match },
        { $unwind: '$lines' },
        {
          $group: {
            _id: '$lines.productId',
            revenue: { $sum: { $multiply: ['$lines.quantity', '$lines.unitPrice'] } },
            unitsSold: { $sum: '$lines.quantity' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]);
      return { groupBy, rows };
    }

    const groupField = groupBy === 'cashier' ? '$cashierId' : groupBy === 'company' ? '$companyId' : '$storeId';
    const rows = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupField,
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    return { groupBy, rows };
  }

  /** Stock on hand and simple stockout flag, grouped by owner/status. */
  async inventory(user: AuthUser, params: { warehouseId?: string; companyId?: string }) {
    const match: Record<string, any> = {};
    if (params.warehouseId) match.ownerId = params.warehouseId;
    Object.assign(match, await this.tenancy.companyMatch(user, params.companyId));

    const byStatus = await this.unitModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byProduct = await this.unitModel.aggregate([
      { $match: { ...match, status: UnitStatus.IN_STOCK } },
      { $group: { _id: '$productId', onHand: { $sum: 1 } } },
      { $sort: { onHand: 1 } },
    ]);
    return { byStatus, byProductOnHand: byProduct };
  }

  /** Revenue vs. landed unit cost, by product — margin at the unit level. */
  async margin(user: AuthUser, params: { companyId?: string; from?: string; to?: string }) {
    const companyMatch = await this.tenancy.companyMatch(user, params.companyId);
    const orderMatch: Record<string, any> = { ...companyMatch };
    if (params.from || params.to) {
      orderMatch.createdAt = {};
      if (params.from) orderMatch.createdAt.$gte = new Date(params.from);
      if (params.to) orderMatch.createdAt.$lte = new Date(params.to);
    }

    const revenueByProduct = await this.orderModel.aggregate([
      { $match: orderMatch },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.productId',
          revenue: { $sum: { $multiply: ['$lines.quantity', '$lines.unitPrice'] } },
          unitsSold: { $sum: '$lines.quantity' },
        },
      },
    ]);

    const costMatch: Record<string, any> = { status: UnitStatus.SOLD, ...companyMatch };
    const costByProduct = await this.unitModel.aggregate([
      { $match: costMatch },
      { $group: { _id: '$productId', totalLandedCost: { $sum: '$landedUnitCost' } } },
    ]);
    const costMap = new Map(costByProduct.map((c) => [String(c._id), c.totalLandedCost]));

    const rows = revenueByProduct.map((r) => {
      const cost = costMap.get(String(r._id)) || 0;
      return {
        productId: r._id,
        revenue: r.revenue,
        unitsSold: r.unitsSold,
        landedCost: cost,
        margin: r.revenue - cost,
      };
    });
    return { rows };
  }

  /** Placeholder — credit is a Field Agent-only capability not yet built in
   * Phase 1; kept so the reporting API surface matches the full spec. */
  async creditAging() {
    return { rows: [], note: 'Le module crédit (agent terrain) n\'est pas encore construit en Phase 1.' };
  }
}
