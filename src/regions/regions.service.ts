import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region, RegionDocument } from './schemas/region.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class RegionsService {
  constructor(
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
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
}
