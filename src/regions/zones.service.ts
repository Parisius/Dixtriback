import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Zone, ZoneDocument } from './schemas/zone.schema';
import { Region, RegionDocument } from './schemas/region.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const DUPLICATE = 'Une zone portant ce nom existe déjà dans cette région.';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(Zone.name) private zoneModel: Model<ZoneDocument>,
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
    private tenancy: TenancyService,
  ) {}

  /** The company comes from the parent region, which the caller must be allowed to see. */
  async create(user: AuthUser, dto: Record<string, any>) {
    const region = await this.regionModel.findById(String(dto.regionId)).exec().catch(() => null);
    await this.tenancy.assertOwns(user, region, 'Région introuvable');
    if (region!.isActive === false) {
      throw new BadRequestException("Impossible d'ajouter une zone à une région désactivée.");
    }
    const { companyId: _c, ...rest } = dto;
    try {
      return await new this.zoneModel({
        ...rest,
        regionId: String(region!._id),
        companyId: String(region!.companyId),
      }).save();
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(DUPLICATE);
      throw err;
    }
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string, regionId?: unknown) {
    const filter: Record<string, any> = {};
    if (typeof regionId === 'string' && regionId) filter.regionId = regionId;
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));
    const [data, total] = await Promise.all([
      this.zoneModel.find(filter).skip((page - 1) * limit).limit(limit).sort('name').exec(),
      this.zoneModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const zone = await this.zoneModel.findById(id).exec();
    return this.tenancy.assertOwns(user, zone, 'Zone introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    // company and parent region are fixed for the life of a zone
    const { regionId: _r, ...safe } = this.tenancy.stripImmutable(dto);
    try {
      const updated = await this.zoneModel.findByIdAndUpdate(id, { $set: safe }, { new: true }).exec();
      if (!updated) throw new NotFoundException('Zone introuvable');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(DUPLICATE);
      throw err;
    }
  }

  async remove(user: AuthUser, id: string) {
    await this.findById(user, id);
    await this.zoneModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
