import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private purchaseOrderModel: Model<PurchaseOrderDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.purchaseOrderModel({
      ...dto,
      status: PurchaseOrderStatus.PENDING_APPROVAL,
    }).save();
  }

  async findAll(page = 1, limit = 20, companyId?: string, status?: string) {
    const filter: Record<string, any> = {};
    if (companyId) filter.companyId = companyId;
    if (status) filter.status = status;
    const [data, total] = await Promise.all([
      this.purchaseOrderModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.purchaseOrderModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string) {
    const po = await this.purchaseOrderModel.findById(id).exec();
    if (!po) throw new NotFoundException('Bon de commande introuvable');
    return po;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.purchaseOrderModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Bon de commande introuvable');
    return updated;
  }

  async approve(id: string, approvedBy?: string) {
    const updated = await this.purchaseOrderModel
      .findByIdAndUpdate(
        id,
        { status: PurchaseOrderStatus.APPROVED, approvedBy: approvedBy ?? null },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Bon de commande introuvable');
    return updated;
  }
}
