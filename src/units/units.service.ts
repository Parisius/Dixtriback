import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/constants/roles.enum';
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
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Unité introuvable');
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) throw new NotFoundException('Unité introuvable');
    return unit;
  }

  async findById(user: AuthUser, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Unité introuvable');
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

  /** Public, scoped transfer of ONE unit: it must belong to one of the caller's
   * companies, be in stock, and go to a warehouse/store/field agent of that same company. */
  async transfer(
    user: AuthUser,
    id: string,
    toOwnerType: UnitOwnerType,
    toOwnerId: string,
    note?: string,
  ) {
    const unit = await this.findById(user, id);
    const [moved] = await this.transferMany(String(unit.companyId), [id], toOwnerType, toOwnerId, {
      note,
      by: user.userId,
    });
    return moved;
  }

  /**
   * Moves several units all-or-nothing: every unit and the destination are
   * validated BEFORE anything moves, so a bad unit in the batch cannot leave
   * the others half-transferred. Rules for each unit: it belongs to
   * `companyId`, is `in_stock` (sold / damaged / written-off units never move),
   * and — when `from` is given — really is in that source.
   */
  async transferMany(
    companyId: string,
    ids: string[],
    toOwnerType: UnitOwnerType,
    toOwnerId: string,
    opts: { note?: string; by?: string; from?: { type: UnitOwnerType; id: string } } = {},
  ) {
    if (![UnitOwnerType.WAREHOUSE, UnitOwnerType.STORE, UnitOwnerType.FIELD_AGENT].includes(toOwnerType)) {
      throw new BadRequestException(
        'Destination non autorisée : seuls entrepôt, boutique ou agent terrain. Les ventes passent par /v1/orders.',
      );
    }
    const uniqueIds = [...new Set(ids)];
    const units = await Promise.all(uniqueIds.map((id) => this.getUnit(id)));
    for (const unit of units) {
      if (String(unit.companyId) !== companyId) throw new NotFoundException('Unité introuvable');
      if (unit.status !== UnitStatus.IN_STOCK) {
        throw new ConflictException(
          `L'unité ${unit.serial} n'est pas transférable (statut : ${unit.status}).`,
        );
      }
      if (opts.from && !(unit.ownerType === opts.from.type && String(unit.ownerId) === opts.from.id)) {
        throw new ConflictException(`L'unité ${unit.serial} ne se trouve pas dans cette source.`);
      }
      if (unit.ownerType === toOwnerType && String(unit.ownerId) === toOwnerId) {
        throw new ConflictException(`L'unité ${unit.serial} est déjà à cette destination.`);
      }
    }
    await this.assertOwnerInCompany(toOwnerType, toOwnerId, companyId);

    const moved: UnitDocument[] = [];
    for (const unit of units) {
      moved.push(await this.move(unit.id, toOwnerType, toOwnerId, opts.note, opts.by));
    }
    return moved;
  }

  /** Internal move, no checks — only for code that has already validated
   * company ownership and state (transferMany, POS checkout / returns). */
  async move(id: string, toOwnerType: UnitOwnerType, toOwnerId: string, note?: string, by?: string) {
    const unit = await this.getUnit(id);
    unit.history.push({
      event: 'transfer',
      fromOwnerType: unit.ownerType,
      fromOwnerId: unit.ownerId,
      toOwnerType,
      toOwnerId,
      note: note ?? null,
      by: by ?? null,
      at: new Date(),
    });
    unit.ownerType = toOwnerType;
    unit.ownerId = toOwnerId;
    unit.status = toOwnerType === UnitOwnerType.SOLD ? UnitStatus.SOLD : UnitStatus.IN_STOCK;
    return unit.save();
  }

  /**
   * Declares a unit damaged / written off, or puts a repaired one back in
   * stock. The unit keeps its owner (traceability) but leaves sellable stock:
   * POS and the on-hand report only count `in_stock`. Sold units never change
   * here (returns go through the order), and written_off is final.
   */
  async changeStatus(user: AuthUser, id: string, status: UnitStatus, reason: string) {
    const unit = await this.findById(user, id);
    const allowed: Partial<Record<UnitStatus, UnitStatus[]>> = {
      [UnitStatus.IN_STOCK]: [UnitStatus.DAMAGED, UnitStatus.WRITTEN_OFF],
      [UnitStatus.DAMAGED]: [UnitStatus.WRITTEN_OFF, UnitStatus.IN_STOCK],
    };
    if (!allowed[unit.status]?.includes(status)) {
      throw new ConflictException(`Passage de "${unit.status}" à "${status}" impossible.`);
    }
    unit.history.push({
      event: 'status_change',
      from: unit.status,
      to: status,
      reason,
      by: user.userId,
      at: new Date(),
    });
    unit.status = status;
    return unit.save();
  }

  private async assertOwnerInCompany(ownerType: UnitOwnerType, ownerId: string, companyId: string) {
    if (!ownerId || !Types.ObjectId.isValid(ownerId)) throw new NotFoundException('Destination introuvable');
    let exists: unknown;
    if (ownerType === UnitOwnerType.WAREHOUSE) {
      exists = await this.warehouseModel.exists({ _id: ownerId, companyId });
    } else if (ownerType === UnitOwnerType.STORE) {
      exists = await this.storeModel.exists({ _id: ownerId, companyId });
    } else if (ownerType === UnitOwnerType.FIELD_AGENT) {
      exists = await this.userModel.exists({ _id: ownerId, companyId, role: Role.FIELD_AGENT, isActive: { $ne: false } });
    }
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
