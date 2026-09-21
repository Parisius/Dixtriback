import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { UnitsService } from '../units/units.service';
import { UnitOwnerType } from '../units/schemas/unit.schema';
import { TransferStockDto } from './dto/warehouse.dto';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    private unitsService: UnitsService,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    return new this.warehouseModel({ ...dto, companyId }).save();
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string, tier?: string) {
    const filter: Record<string, any> = {};
    if (tier) filter.tier = tier;
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));
    const [data, total] = await Promise.all([
      this.warehouseModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.warehouseModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const warehouse = await this.warehouseModel.findById(id).exec();
    return this.tenancy.assertOwns(user, warehouse, 'Entrepôt introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    const updated = await this.warehouseModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Entrepôt introuvable');
    return updated;
  }

  /**
   * Moves a batch of serialized units out of this warehouse to a Regional
   * Warehouse, a Field Agent, or a Store. Each unit's ownership-transfer
   * history is updated individually via UnitsService.transfer — this is
   * what "approving a transfer" actually does at the data level.
   */
  async transferStock(user: AuthUser, warehouseId: string, dto: TransferStockDto) {
    const warehouse = await this.findById(user, warehouseId); // 404s if missing or in another company
    const companyId = String(warehouse.companyId);

    const toOwnerType =
      dto.toType === 'warehouse'
        ? UnitOwnerType.WAREHOUSE
        : dto.toType === 'store'
          ? UnitOwnerType.STORE
          : UnitOwnerType.FIELD_AGENT;
    const toOwnerId = dto.toWarehouseId || dto.toStoreId;
    if (!toOwnerId) {
      throw new NotFoundException('Destination du transfert manquante (toWarehouseId ou toStoreId)');
    }

    const results = await Promise.all(
      dto.unitIds.map((unitId) =>
        // units and destination must both belong to the source warehouse's company
        this.unitsService.transferChecked(companyId, unitId, toOwnerType, toOwnerId, dto.note),
      ),
    );
    return { transferred: results.length, units: results };
  }
}
