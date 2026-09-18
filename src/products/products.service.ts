import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.productModel(dto).save();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    companyId?: string;
    q?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.companyId) filter.companyId = query.companyId;
    if (query.q) filter.name = { $regex: query.q, $options: 'i' };

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

  async findById(id: string) {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.productModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Produit introuvable');
    return updated;
  }

  async remove(id: string) {
    const res = await this.productModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!res) throw new NotFoundException('Produit introuvable');
  }
}
