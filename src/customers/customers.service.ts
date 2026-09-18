import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    // Only the schema is needed here (read-only order history lookups), so
    // it's injected directly rather than depending on the whole OrdersModule.
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.customerModel(dto).save();
  }

  async findAll(query: { page?: number; limit?: number; companyId?: string; q?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.companyId) filter.companyId = query.companyId;
    if (query.q) {
      filter.$or = [
        { name: { $regex: query.q, $options: 'i' } },
        { phone: { $regex: query.q, $options: 'i' } },
        { email: { $regex: query.q, $options: 'i' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string) {
    const customer = await this.customerModel.findById(id).exec();
    if (!customer) throw new NotFoundException('Client introuvable');
    return customer;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.customerModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Client introuvable');
    return updated;
  }

  async orderHistory(id: string, page = 1, limit = 20) {
    await this.findById(id);
    const filter = { customerId: id };
    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }
}
