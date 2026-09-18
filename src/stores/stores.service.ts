import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from './schemas/store.schema';

@Injectable()
export class StoresService {
  constructor(@InjectModel(Store.name) private storeModel: Model<StoreDocument>) {}

  create(dto: Record<string, any>) {
    return new this.storeModel(dto).save();
  }

  async findAll(page = 1, limit = 20, companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const [data, total] = await Promise.all([
      this.storeModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.storeModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string) {
    const store = await this.storeModel.findById(id).exec();
    if (!store) throw new NotFoundException('Boutique introuvable');
    return store;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.storeModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Boutique introuvable');
    return updated;
  }

  async remove(id: string) {
    const res = await this.storeModel.findByIdAndUpdate(id, { isActive: false }).exec();
    if (!res) throw new NotFoundException('Boutique introuvable');
  }
}
