import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    // Only the schema is needed here (read-only order history lookups), so
    // it's injected directly rather than depending on the whole OrdersModule.
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    return new this.customerModel({ ...dto, companyId }).save();
  }

  async findAll(user: AuthUser, query: { page?: number; limit?: number; companyId?: string; q?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.q) {
      filter.$or = [
        { name: { $regex: query.q, $options: 'i' } },
        { phone: { $regex: query.q, $options: 'i' } },
        { email: { $regex: query.q, $options: 'i' } },
      ];
    }
    Object.assign(filter, await this.tenancy.companyFilter(user, query.companyId));
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

  async findById(user: AuthUser, id: string) {
    const customer = await this.customerModel.findById(id).exec();
    return this.tenancy.assertOwns(user, customer, 'Client introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    const updated = await this.customerModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Client introuvable');
    return updated;
  }

  async orderHistory(user: AuthUser, id: string, page = 1, limit = 20) {
    const customer = await this.findById(user, id);
    const filter = { customerId: id, companyId: customer.companyId };
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
