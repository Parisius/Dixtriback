import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../warehouses/schemas/warehouse.schema';
import { Store, StoreDocument } from '../stores/schemas/store.schema';
import { Model } from 'mongoose';
import { Unit, UnitDocument, UnitOwnerType, UnitStatus } from './schemas/unit.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name) private unitModel: Model<UnitDocument>,
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    private tenancy: TenancyService,
  ) {}

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

  async findAll(user: AuthUser, query: {
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
    Object.assign(filter, await this.tenancy.companyFilter(user, query.companyId));

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

  /** Internal lookup with no ownership check — callers must already have
   * verified the company (see findById / transferChecked). */
  private async getUnit(id: string) {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) throw new NotFoundException('Unité introuvable');
    return unit;
  }

  async findById(user: AuthUser, id: string) {
    const unit = await this.unitModel.findById(id).exec();
    return this.tenancy.assertOwns(user, unit, 'Unité introuvable');
  }

  async findBySerial(user: AuthUser, serial: string) {
    const unit = await this.unitModel.findOne({ serial }).exec();
    return this.tenancy.assertOwns(user, unit, 'Unité introuvable');
  }

  /** Picks `quantity` in-stock units of a product owned by a given owner
   * (typically a Store at POS checkout time), oldest-received first. */
  async findAvailable(
    companyId: string,
    ownerType: UnitOwnerType,
    ownerId: string,
    productId: string,
    quantity: number,
  ) {
    return this.unitModel
      .find({ companyId, ownerType, ownerId, productId, status: UnitStatus.IN_STOCK })
      .sort('createdAt')
      .limit(quantity)
      .exec();
  }

  /** Public, scoped transfer: the unit must belong to one of the caller's
   * companies, and the destination must be in that same company. */
  async transfer(
    user: AuthUser,
    id: string,
    toOwnerType: UnitOwnerType,
    toOwnerId: string,
    note?: string,
  ) {
    const unit = await this.findById(user, id);
    return this.transferChecked(String(unit.companyId), id, toOwnerType, toOwnerId, note);
  }

  /** Moves a unit only if it belongs to `companyId` AND the destination
   * warehouse/store belongs to that same company. */
  async transferChecked(
    companyId: string,
    id: string,
    toOwnerType: UnitOwnerType,
    toOwnerId: string,
    note?: string,
  ) {
    const unit = await this.getUnit(id);
    if (String(unit.companyId) !== companyId) throw new NotFoundException('Unité introuvable');
    await this.assertOwnerInCompany(toOwnerType, toOwnerId, companyId);
    return this.move(id, toOwnerType, toOwnerId, note);
  }

  /** Internal move, no checks — only for code that has already validated
   * company ownership (POS checkout / returns). */
  async move(id: string, toOwnerType: UnitOwnerType, toOwnerId: string, note?: string) {
    const unit = await this.getUnit(id);
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

  private async assertOwnerInCompany(ownerType: UnitOwnerType, ownerId: string, companyId: string) {
    const model =
      ownerType === UnitOwnerType.WAREHOUSE
        ? this.warehouseModel
        : ownerType === UnitOwnerType.STORE
          ? this.storeModel
          : null;
    if (!model) return; // field agent / sold: no company-owned record to check
    if (!Types.ObjectId.isValid(ownerId)) throw new NotFoundException('Destination introuvable');
    const exists = await (model as Model<any>).exists({ _id: ownerId, companyId });
    if (!exists) throw new NotFoundException('Destination introuvable');
  }

  /** Full trace-back: the unit's own accumulated history is already the
   * whole chain, Supplier -> Shipment -> ... -> Sale. */
  async trace(user: AuthUser, serial: string) {
    const unit = await this.findBySerial(user, serial);
    return { unit, chain: unit.history };
  }

  private generateSerial() {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SN-${Date.now().toString(36).toUpperCase()}-${rand}`;
  }
}
