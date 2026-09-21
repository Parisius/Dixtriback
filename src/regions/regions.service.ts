import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region, RegionDocument } from './schemas/region.schema';
import { Zone, ZoneDocument } from './schemas/zone.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class RegionsService {
  constructor(
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
    @InjectModel(Zone.name) private zoneModel: Model<ZoneDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    try {
      return await new this.regionModel({ ...dto, companyId }).save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Une région portant ce nom existe déjà dans cette entreprise.');
      }
      throw err;
    }
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string) {
    const filter = await this.tenancy.companyFilter(user, companyId);
    const [data, total] = await Promise.all([
      this.regionModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('name')
        .exec(),
      this.regionModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const region = await this.regionModel.findById(id).exec();
    return this.tenancy.assertOwns(user, region, 'Région introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    try {
      const updated = await this.regionModel
        .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
        .exec();
      if (!updated) throw new NotFoundException('Région introuvable');
      if (updated.isActive === false) await this.deactivateZones(id);
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('Une région portant ce nom existe déjà dans cette entreprise.');
      }
      throw err;
    }
  }

  async remove(user: AuthUser, id: string) {
    await this.findById(user, id);
    await this.regionModel.findByIdAndUpdate(id, { isActive: false }).exec();
    await this.deactivateZones(id);
  }

  /** A deactivated region takes its zones with it. */
  private async deactivateZones(regionId: string) {
    await this.zoneModel.updateMany({ regionId }, { isActive: false }).exec();
  }

  /**
   * Every `regionId` set on a store / warehouse / user must be a real, active
   * region of that record's own company. null/undefined (clearing it) is fine.
   */
  async assertUsable(companyId: unknown, regionId: unknown): Promise<void> {
    if (regionId === undefined || regionId === null || regionId === '') return;
    if (
      !companyId ||
      typeof regionId !== 'string' ||
      !Types.ObjectId.isValid(regionId) ||
      !(await this.regionModel.exists({
        _id: regionId,
        companyId: String(companyId),
        isActive: { $ne: false },
      }))
    ) {
      throw new BadRequestException(
        "regionId invalide : la région doit exister et appartenir à l'entreprise (POST /v1/regions).",
      );
    }
  }

  /**
   * Validates the region/zone a store, warehouse or user is being placed in and
   * returns any field that must be derived (only ever `regionId`):
   *  - a zone must be active, in the record's company, and inside the region;
   *  - a zone given without a region pulls its region in automatically;
   *  - on update the record's current region/zone are taken into account, so
   *    moving to another region while keeping an old zone is refused.
   */
  async resolveGeo(
    companyId: unknown,
    current: { regionId?: any; zoneId?: any } | null,
    dto: Record<string, any>,
  ): Promise<{ regionId?: string }> {
    if (dto.regionId === undefined && dto.zoneId === undefined) return {};
    const out: { regionId?: string } = {};
    let regionId = (dto.regionId !== undefined ? dto.regionId : current?.regionId) || null;
    const zoneId = (dto.zoneId !== undefined ? dto.zoneId : current?.zoneId) || null;

    if (zoneId) {
      if (dto.regionId !== undefined && !dto.regionId) {
        throw new BadRequestException('Retirez aussi zoneId pour retirer la région.');
      }
      const zone =
        companyId && typeof zoneId === 'string' && Types.ObjectId.isValid(zoneId)
          ? await this.zoneModel
              .findOne({ _id: zoneId, companyId: String(companyId), isActive: { $ne: false } })
              .exec()
          : null;
      if (!zone) {
        throw new BadRequestException(
          "zoneId invalide : la zone doit exister, être active et appartenir à l'entreprise (POST /v1/zones).",
        );
      }
      if (regionId && String(regionId) !== zone.regionId) {
        throw new BadRequestException("Cette zone n'appartient pas à la région indiquée.");
      }
      if (!regionId) {
        regionId = zone.regionId;
        out.regionId = regionId;
      }
    }
    await this.assertUsable(companyId, regionId);
    return out;
  }
}
