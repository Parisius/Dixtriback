import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { UnitsService } from '../units/units.service';
import { UnitOwnerType } from '../units/schemas/unit.schema';
import { TransferStockDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    private unitsService: UnitsService,
  ) {}

  create(dto: Record<string, any>) {
    return new this.warehouseModel(dto).save();
  }

  async findAll(page = 1, limit = 20, companyId?: string, tier?: string) {
    const filter: Record<string, any> = {};
    if (companyId) filter.companyId = companyId;
    if (tier) filter.tier = tier;
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

  async findById(id: string) {
    const warehouse = await this.warehouseModel.findById(id).exec();
    if (!warehouse) throw new NotFoundException('Entrepôt introuvable');
    return warehouse;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.warehouseModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
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
  async transferStock(warehouseId: string, dto: TransferStockDto) {
    await this.findById(warehouseId); // 404s if source warehouse doesn't exist

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
        this.unitsService.transfer(unitId, toOwnerType, toOwnerId, dto.note),
      ),
    );
    return { transferred: results.length, units: results };
  }
}
