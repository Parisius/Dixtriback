import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomRole, CustomRoleDocument } from './schemas/custom-role.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { Role } from '../common/constants/roles.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';

const DUPLICATE = 'Un rôle portant ce nom existe déjà dans cette entreprise.';

@Injectable()
export class CustomRolesService {
  constructor(
    @InjectModel(CustomRole.name) private roleModel: Model<CustomRoleDocument>,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    try {
      return await new this.roleModel({ ...dto, companyId }).save();
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(DUPLICATE);
      throw err;
    }
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string) {
    const filter = await this.tenancy.companyFilter(user, companyId);
    const [data, total] = await Promise.all([
      this.roleModel.find(filter).skip((page - 1) * limit).limit(limit).sort('name').exec(),
      this.roleModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const role = await this.roleModel.findById(id).exec();
    return this.tenancy.assertOwns(user, role, 'Rôle introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    try {
      const updated = await this.roleModel
        .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
        .exec();
      if (!updated) throw new NotFoundException('Rôle introuvable');
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(DUPLICATE);
      throw err;
    }
  }

  async remove(user: AuthUser, id: string) {
    await this.findById(user, id);
    await this.roleModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // ---- Used by UsersService and RolesGuard --------------------------------

  /**
   * Validates a (role, customRoleId) pair for a user being created/updated:
   *  - role !== 'custom': customRoleId must be absent (or is cleared by the caller);
   *  - role === 'custom': customRoleId must be an active role of that company.
   * Returns the customRoleId to persist (null when role isn't 'custom').
   */
  async resolveForUser(
    companyId: unknown,
    role: unknown,
    customRoleId: unknown,
  ): Promise<string | null> {
    if (role !== Role.CUSTOM) {
      if (customRoleId) {
        throw new BadRequestException('customRoleId ne peut être défini que si role="custom".');
      }
      return null;
    }
    if (
      !companyId ||
      typeof customRoleId !== 'string' ||
      !Types.ObjectId.isValid(customRoleId) ||
      !(await this.roleModel.exists({
        _id: customRoleId,
        companyId: String(companyId),
        isActive: { $ne: false },
      }))
    ) {
      throw new BadRequestException(
        'customRoleId invalide : le rôle doit exister, être actif, et appartenir à l\'entreprise (POST /v1/roles).',
      );
    }
    return customRoleId;
  }

  /** Used by RolesGuard: does this user's custom role grant `permission`? */
  async userHasPermission(user: AuthUser, permission: string): Promise<boolean> {
    if (!(user as any).customRoleId || !user.companyId) return false;
    const role = await this.roleModel
      .findOne({
        _id: (user as any).customRoleId,
        companyId: String(user.companyId),
        isActive: { $ne: false },
      })
      .lean()
      .exec();
    return !!role && role.permissions.includes(permission);
  }
}
