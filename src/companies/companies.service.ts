import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';
import { Role } from '../common/constants/roles.enum';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private tenancy: TenancyService,
  ) {}

  /** The creating super admin is recorded in `createdBy` (never taken from
   * the request body). */
  create(user: AuthUser, dto: Record<string, any>) {
    const { createdBy: _ignored, _id: _id, ...rest } = dto;
    return new this.companyModel({
      ...rest,
      createdBy: new Types.ObjectId(user.userId),
    }).save();
  }

  /** A super admin lists every company; anyone else only their own. */
  async findAll(user: AuthUser, page = 1, limit = 20) {
    const ids = await this.tenancy.allowedCompanyIds(user);
    if (user.role !== Role.SUPER_ADMIN && ids.length === 0) {
      throw new ForbiddenException("Aucune entreprise n'est associée à ce compte.");
    }
    const filter = { _id: { $in: ids } };
    const [data, total] = await Promise.all([
      this.companyModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.companyModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const ids = await this.tenancy.allowedCompanyIds(user);
    if (!ids.includes(id)) throw new NotFoundException('Entreprise introuvable');
    const company = await this.companyModel.findById(id).exec();
    if (!company) throw new NotFoundException('Entreprise introuvable');
    return company;
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    const { createdBy: _b, _id: _i, ...safe } = dto;
    const updated = await this.companyModel
      .findByIdAndUpdate(id, { $set: safe }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Entreprise introuvable');
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.findById(user, id);
    await this.companyModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
