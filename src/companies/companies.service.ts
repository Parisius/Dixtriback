import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  create(dto: Record<string, any>) {
    return new this.companyModel(dto).save();
  }

  async findAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.companyModel
        .find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.companyModel.countDocuments().exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(id: string) {
    const company = await this.companyModel.findById(id).exec();
    if (!company) throw new NotFoundException('Entreprise introuvable');
    return company;
  }

  async update(id: string, dto: Record<string, any>) {
    const updated = await this.companyModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Entreprise introuvable');
    return updated;
  }

  async remove(id: string) {
    const res = await this.companyModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!res) throw new NotFoundException('Entreprise introuvable');
  }
}
