import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Segment, SegmentDocument } from './schemas/segment.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';

@Injectable()
export class SegmentsService {
  constructor(
    @InjectModel(Segment.name) private segmentModel: Model<SegmentDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.segmentModel(dto).save();
  }

  async findAll(page = 1, limit = 20, companyId?: string) {
    const filter = companyId ? { companyId } : {};
    const [data, total] = await Promise.all([
      this.segmentModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.segmentModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string) {
    const segment = await this.segmentModel.findById(id).exec();
    if (!segment) throw new NotFoundException('Segment introuvable');
    return segment;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.segmentModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Segment introuvable');
    return updated;
  }

  async members(id: string, page = 1, limit = 20) {
    await this.findById(id);
    const filter = { segmentIds: id };
    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  /** Rebuilds segment membership from its own rules: minSpend, minOrders,
   * tag are matched against Customer.totalSpend / orderCount / tags. */
  async recompute(id: string) {
    const segment = await this.findById(id);
    const { minSpend, minOrders, tag } = segment.rules || {};

    const matchFilter: Record<string, any> = { companyId: segment.companyId };
    if (minSpend !== undefined) matchFilter.totalSpend = { $gte: minSpend };
    if (minOrders !== undefined) matchFilter.orderCount = { $gte: minOrders };
    if (tag) matchFilter.tags = tag;

    await this.customerModel.updateMany(
      { segmentIds: segment.id },
      { $pull: { segmentIds: segment.id } },
    );
    const matched = await this.customerModel.find(matchFilter).exec();
    await this.customerModel.updateMany(
      { _id: { $in: matched.map((c) => c.id) } },
      { $addToSet: { segmentIds: segment.id } },
    );

    segment.customerCount = matched.length;
    segment.lastComputedAt = new Date();
    return segment.save();
  }
}
