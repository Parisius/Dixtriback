import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    // isSystem is never client-settable: only SystemRolesSeeder sets it.
    const { isSystem: _s, ...rest } = dto;
    try {
      return await new this.roleModel({ ...rest, companyId, isSystem: false }).save();
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(DUPLICATE);
      throw err;
    }
  }

  /** Generic (system) roles are always included, alongside the caller's own
   * company's custom roles — that's the whole point of this list. */
  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string) {
    const companyFilter = await this.tenancy.companyFilter(user, companyId); // throws if not allowed
    const filter = { $or: [{ isSystem: true }, companyFilter] };
    const [data, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ isSystem: -1, name: 1 })
        .exec(),
      this.roleModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  /** Generic roles carry no company data, so they're readable by anyone
   * (same as the permission catalog). A company's own role still requires
   * ownership. */
  async findById(user: AuthUser, id: string) {
    const role = await this.roleModel.findById(id).exec();
    if (!role) throw new NotFoundException('Rôle introuvable');
    if (role.isSystem) return role;
    return this.tenancy.assertOwns(user, role, 'Rôle introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    const role = await this.findById(user, id);
    if (role.isSystem) {
      throw new ForbiddenException('Les rôles génériques ne peuvent pas être modifiés.');
    }
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
    const role = await this.findById(user, id);
    if (role.isSystem) {
      throw new ForbiddenException('Les rôles génériques ne peuvent pas être désactivés.');
    }
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
        isSystem: { $ne: true },
      }))
    ) {
      throw new BadRequestException(
        'customRoleId invalide : le rôle doit exister, être actif, appartenir à l\'entreprise, ' +
          'et ne pas être un rôle générique (POST /v1/roles).',
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
        isSystem: { $ne: true },
      })
      .lean()
      .exec();
    return !!role && role.permissions.includes(permission);
  }
}
