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

    const unitIds = await this.resolveUnitIds(companyId, warehouseId, dto);

    // Units must be in stock IN THIS warehouse, and everything is validated
    // before anything moves (all-or-nothing).
    const results = await this.unitsService.transferMany(companyId, unitIds, dest.type, dest.id, {
      note: dto.note,
      by: user.userId,
      from: { type: UnitOwnerType.WAREHOUSE, id: warehouseId },
    });
    return { transferred: results.length, units: results };
  }

  /** Either an explicit `unitIds` list, or `productId` + `quantity` — in which
   * case the oldest-received in-stock units of that product, in this
   * warehouse, are picked automatically (same rule as POS checkout). */
  private async resolveUnitIds(companyId: string, warehouseId: string, dto: TransferStockDto): Promise<string[]> {
    const hasIds = !!dto.unitIds?.length;
    const hasQty = !!(dto.productId && dto.quantity);
    if (hasIds && hasQty) {
      throw new BadRequestException('Fournir "unitIds" OU "productId" + "quantity", pas les deux.');
    }
    if (hasIds) return dto.unitIds!;
    if (!hasQty) {
      throw new BadRequestException('Fournir "unitIds", ou "productId" + "quantity".');
    }
    const available = await this.unitsService.findAvailable(
      companyId,
      UnitOwnerType.WAREHOUSE,
      warehouseId,
      dto.productId!,
      dto.quantity!,
    );
    if (available.length < dto.quantity!) {
      throw new BadRequestException(
        `Stock insuffisant pour ce produit dans cet entrepôt (${available.length}/${dto.quantity} disponibles).`,
      );
    }
    return available.map((u) => u.id);
  }

  /** This warehouse's quantity per product, broken down by status
   * (in_stock/sold/damaged/...). See UnitsService.stockForOwner. */
  async inventory(user: AuthUser, id: string) {
    const warehouse = await this.findById(user, id); // 404s if missing or in another company
    return this.unitsService.stockForOwner(user, UnitOwnerType.WAREHOUSE, String(warehouse.id));
  }
}
