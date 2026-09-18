import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<SupplierDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.supplierModel(dto).save();
  }

  async findAll(page = 1, limit = 20, companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const [data, total] = await Promise.all([
      this.supplierModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.supplierModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string) {
    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier) throw new NotFoundException('Fournisseur introuvable');
    return supplier;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.supplierModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Fournisseur introuvable');
    return updated;
  }

  async remove(id: string) {
    const res = await this.supplierModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!res) throw new NotFoundException('Fournisseur introuvable');
  }
}
