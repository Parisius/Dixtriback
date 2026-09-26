import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { UnitsService } from '../units/units.service';
import { UnitOwnerType } from '../units/schemas/unit.schema';
import { TransferStockDto } from './dto/warehouse.dto';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RegionsService } from '../regions/regions.service';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    private unitsService: UnitsService,
    private tenancy: TenancyService,
    private regions: RegionsService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    const geo = await this.regions.resolveGeo(companyId, null, dto);
    return new this.warehouseModel({ ...dto, ...geo, companyId }).save();
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
    const current = await this.findById(user, id);
    const geo = await this.regions.resolveGeo(current.companyId, current, dto);
    const updated = await this.warehouseModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable({ ...dto, ...geo }) }, { new: true })
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

    const dest =
      dto.toType === 'warehouse'
        ? { type: UnitOwnerType.WAREHOUSE, id: dto.toWarehouseId, field: 'toWarehouseId' }
        : dto.toType === 'store'
          ? { type: UnitOwnerType.STORE, id: dto.toStoreId, field: 'toStoreId' }
          : { type: UnitOwnerType.FIELD_AGENT, id: dto.toAgentId, field: 'toAgentId' };
    if (!dest.id) {
      throw new BadRequestException(`Destination manquante : ${dest.field} est requis quand toType = "${dto.toType}".`);
    }
    if (dest.type === UnitOwnerType.WAREHOUSE && dest.id === warehouseId) {
      throw new BadRequestException("L'entrepôt de destination doit être différent de l'entrepôt source.");
    }

    // Units must be in stock IN THIS warehouse, and everything is validated
    // before anything moves (all-or-nothing).
    const results = await this.unitsService.transferMany(companyId, dto.unitIds, dest.type, dest.id, {
      note: dto.note,
      by: user.userId,
      from: { type: UnitOwnerType.WAREHOUSE, id: warehouseId },
    });
    return { transferred: results.length, units: results };
  }
}
