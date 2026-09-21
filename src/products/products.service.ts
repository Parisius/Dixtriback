import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { Role } from '../common/constants/roles.enum';

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    return new this.productModel({ ...dto, companyId }).save();
  }

  /**
   * Storefront customers browse every company's ACTIVE products (they have no
   * company of their own). Everyone else is confined to their own company.
   */
  async findAll(user: AuthUser, query: {
    page?: number;
    limit?: number;
    companyId?: string;
    q?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.q) filter.name = { $regex: escapeRegex(String(query.q)), $options: 'i' };
    if (user.role === Role.CUSTOMER) {
      filter.isActive = { $ne: false };
      // A customer may narrow to one company's shop, but never needs a token scope.
      if (typeof query.companyId === 'string' && query.companyId) filter.companyId = query.companyId;
    } else {
      Object.assign(filter, await this.tenancy.companyFilter(user, query.companyId));
    }
    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findById(user: AuthUser, id: string) {
    const product = await this.productModel.findById(id).exec();
    if (user.role === Role.CUSTOMER) {
      if (!product || product.isActive === false) throw new NotFoundException('Produit introuvable');
      return product;
    }
    return this.tenancy.assertOwns(user, product, 'Produit introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    const product = await this.productModel.findById(id).exec();
    await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    const updated = await this.productModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Produit introuvable');
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    const product = await this.productModel.findById(id).exec();
    await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    await this.productModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
