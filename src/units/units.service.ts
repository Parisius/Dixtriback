import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Unit, UnitDocument, UnitOwnerType, UnitStatus } from './schemas/unit.schema';

@Injectable()
export class UnitsService {
  constructor(@InjectModel(Unit.name) private unitModel: Model<UnitDocument>) {}

  /** Called by ShipmentsService when a shipment is received — one Unit per
   * physical item, each with its own generated serial. */
  async createBatch(
    units: Array<{
      companyId: string;
      productId: string;
      shipmentId: string;
      landedUnitCost: number;
      ownerId: string;
    }>,
  ) {
    const docs = units.map((u) => ({
      ...u,
      serial: this.generateSerial(),
      ownerType: UnitOwnerType.WAREHOUSE,
      status: UnitStatus.IN_STOCK,
      history: [
        {
          event: 'created_at_receiving',
          ownerType: UnitOwnerType.WAREHOUSE,
          ownerId: u.ownerId,
          at: new Date(),
        },
      ],
    }));
    return this.unitModel.insertMany(docs);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    ownerType?: string;
    status?: string;
    companyId?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.ownerType) filter.ownerType = query.ownerType;
    if (query.status) filter.status = query.status;
    if (query.companyId) filter.companyId = query.companyId;

    const [data, total] = await Promise.all([
      this.unitModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.unitModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string) {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) throw new NotFoundException('Unité introuvable');
    return unit;
  }

  async findBySerial(serial: string) {
    const unit = await this.unitModel.findOne({ serial }).exec();
    if (!unit) throw new NotFoundException('Unité introuvable');
    return unit;
  }

  /** Picks `quantity` in-stock units of a product owned by a given owner
   * (typically a Store at POS checkout time), oldest-received first. */
  async findAvailable(
    ownerType: UnitOwnerType,
    ownerId: string,
    productId: string,
    quantity: number,
  ) {
    return this.unitModel
      .find({ ownerType, ownerId, productId, status: UnitStatus.IN_STOCK })
      .sort('createdAt')
      .limit(quantity)
      .exec();
  }

  async transfer(id: string, toOwnerType: UnitOwnerType, toOwnerId: string, note?: string) {
    const unit = await this.findById(id);
    unit.history.push({
      event: 'transfer',
      fromOwnerType: unit.ownerType,
      fromOwnerId: unit.ownerId,
      toOwnerType,
      toOwnerId,
      note: note ?? null,
      at: new Date(),
    });
    unit.ownerType = toOwnerType;
    unit.ownerId = toOwnerId;
    unit.status = toOwnerType === UnitOwnerType.SOLD ? UnitStatus.SOLD : UnitStatus.IN_STOCK;
    return unit.save();
  }

  /** Full trace-back: the unit's own accumulated history is already the
   * whole chain, Supplier -> Shipment -> ... -> Sale. */
  async trace(serial: string) {
    const unit = await this.findBySerial(serial);
    return { unit, chain: unit.history };
  }

  private generateSerial() {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SN-${Date.now().toString(36).toUpperCase()}-${rand}`;
  }
}
