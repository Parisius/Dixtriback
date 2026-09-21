import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store, StoreDocument } from './schemas/store.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    return new this.storeModel({ ...dto, companyId }).save();
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string) {
    const filter: Record<string, any> = {};
    // Applied last: nothing the client sends can widen the company scope.
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));
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

  async findById(user: AuthUser, id: string) {
    const doc = await this.storeModel.findById(id).exec();
    return this.tenancy.assertOwns(user, doc, 'Boutique introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    const updated = await this.storeModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Boutique introuvable');
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.findById(user, id);
    await this.storeModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
