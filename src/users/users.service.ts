import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /** dto is typed loosely so any extra properties beyond the DTO's own
   * fields (allowed through by the global ValidationPipe) are preserved
   * when spread into the document. */
  async create(dto: Record<string, any>): Promise<UserDocument> {
    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);
    const created = new this.userModel({ ...rest, passwordHash });
    return created.save();
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    companyId?: string;
  }): Promise<{ data: UserDocument[]; total: number; page: number; limit: number }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.companyId) filter.companyId = query.companyId;

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+passwordHash').exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).select('+passwordHash').exec();
  }

  async update(id: string, dto: Record<string, any>): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Utilisateur introuvable');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndUpdate(id, { isActive: false }).exec();
    if (!res) throw new NotFoundException('Utilisateur introuvable');
  }
}
