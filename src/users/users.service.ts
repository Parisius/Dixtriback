import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../common/constants/roles.enum';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** Fields nobody may set through the users API. */
const FORBIDDEN_FIELDS = ['_id', 'passwordHash', 'createdAt', 'updatedAt'];
const strip = (dto: Record<string, any>) =>
  Object.fromEntries(Object.entries(dto ?? {}).filter(([k]) => !FORBIDDEN_FIELDS.includes(k)));

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private tenancy: TenancyService,
  ) {}

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

  // ---- Company-scoped API used by UsersController ------------------------
  // (create/findById/update above stay unscoped: they are internal helpers
  // for the auth flow, which has no company context yet.)

  async createScoped(user: AuthUser, dto: Record<string, any>): Promise<UserDocument> {
    const data = strip(dto);
    if (data.role === Role.SUPER_ADMIN) {
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Seul un super admin peut créer un super admin.');
      }
      return this.create({ ...data, companyId: null });
    }
    const companyId = await this.tenancy.companyForCreate(user, data.companyId);
    return this.create({ ...data, companyId });
  }

  async findAllScoped(
    user: AuthUser,
    query: { page?: number; limit?: number; companyId?: string },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter = await this.tenancy.companyFilter(user, query.companyId);
    const [data, total] = await Promise.all([
      this.userModel.find(filter).skip((page - 1) * limit).limit(limit).sort('-createdAt').exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  /** A user may always read themselves; otherwise the target must be in one of the caller's companies. */
  async findByIdScoped(user: AuthUser, id: string): Promise<UserDocument> {
    const target = await this.userModel.findById(id).exec();
    if (target && target.id === user.userId) return target;
    return this.tenancy.assertOwns(user, target, 'Utilisateur introuvable');
  }

  async updateScoped(user: AuthUser, id: string, dto: Record<string, any>): Promise<UserDocument> {
    const target = await this.findByIdScoped(user, id);
    const isSelf = target.id === user.userId;
    if (target.role === Role.SUPER_ADMIN && !isSelf) {
      throw new ForbiddenException('Un super admin ne peut être modifié que par lui-même.');
    }
    // companyId is immutable here; password is hashed; role changes are guarded.
    const { password, companyId: _c, role, ...rest } = strip(dto);
    const changes: Record<string, any> = { ...rest };
    if (role !== undefined) {
      if (isSelf) throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle.');
      if (role === Role.SUPER_ADMIN) {
        throw new ForbiddenException("Le rôle super admin ne peut pas être attribué ici.");
      }
      changes.role = role;
    }
    if (password) changes.passwordHash = await bcrypt.hash(password, 10);
    return this.update(id, changes);
  }

  async removeScoped(user: AuthUser, id: string): Promise<void> {
    const target = await this.findByIdScoped(user, id);
    if (target.role === Role.SUPER_ADMIN && target.id !== user.userId) {
      throw new ForbiddenException('Un super admin ne peut être désactivé que par lui-même.');
    }
    await this.remove(id);
  }
}
