import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private purchaseOrderModel: Model<PurchaseOrderDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    return new this.purchaseOrderModel({ ...dto, companyId, status: PurchaseOrderStatus.PENDING_APPROVAL }).save();
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string, status?: string, q?: string) {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (typeof q === 'string' && q.trim()) {
      filter.name = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    // Applied last: nothing the client sends can widen the company scope.
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));
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

  async findById(user: AuthUser, id: string) {
    const doc = await this.purchaseOrderModel.findById(id).exec();
    return this.tenancy.assertOwns(user, doc, 'Bon de commande introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    if ('name' in dto && (typeof dto.name !== 'string' || dto.name.trim().length < 2 || dto.name.length > 120)) {
      throw new BadRequestException('name doit contenir entre 2 et 120 caractères.');
    }
    const updated = await this.purchaseOrderModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Bon de commande introuvable');
    return updated;
  }

  async approve(user: AuthUser, id: string, approvedBy?: string) {
    await this.findById(user, id);
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
