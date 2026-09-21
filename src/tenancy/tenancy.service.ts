import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { Role } from '../common/constants/roles.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Single source of truth for multi-company isolation.
 *
 * - A regular user (admin, cashier, ...) may only touch the company in their
 *   signed access token (`companyId`). Anything they send is checked against it.
 * - A super admin may touch exactly the companies they created
 *   (`Company.createdBy`). Super admins never see each other's companies.
 * - A user with no company (customers, ...) has no access to company data.
 */
@Injectable()
export class TenancyService {
  constructor(@InjectModel(Company.name) private companyModel: Model<CompanyDocument>) {}

  /** Ids (as strings) of every company this user is allowed to access. */
  async allowedCompanyIds(user: AuthUser): Promise<string[]> {
    if (user.role === Role.SUPER_ADMIN) {
      const companies = await this.companyModel
        .find({ createdBy: new Types.ObjectId(user.userId) })
        .select('_id')
        .lean()
        .exec();
      return companies.map((c) => String(c._id));
    }
    return user.companyId ? [String(user.companyId)] : [];
  }

  /**
   * Mongo filter fragment restricting a query to the caller's companies.
   * `requested` is the optional `?companyId=` from the client: it can only
   * narrow the scope, never widen it. Merge the result LAST so nothing the
   * client sends can override it.
   */
  async companyFilter(
    user: AuthUser,
    requested?: unknown,
    field = 'companyId',
  ): Promise<Record<string, any>> {
    const ids = await this.allowedCompanyIds(user);
    if (user.role !== Role.SUPER_ADMIN && ids.length === 0) {
      throw new ForbiddenException("Aucune entreprise n'est associée à ce compte.");
    }
    if (requested !== undefined && requested !== null && requested !== '') {
      if (typeof requested !== 'string' || !ids.includes(requested)) {
        throw new ForbiddenException("Cette entreprise n'est pas accessible avec ce compte.");
      }
      return { [field]: requested };
    }
    return { [field]: ids.length === 1 ? ids[0] : { $in: ids } };
  }

  /**
   * Same as companyFilter but for aggregation pipelines, which (unlike find)
   * do not cast values through the schema. Ids are stored as strings today
   * (the schemas declare `Types.ObjectId`, which Mongoose treats as a plain
   * string here), so match both forms: this keeps working if the schemas are
   * ever migrated to real ObjectIds.
   */
  async companyMatch(user: AuthUser, requested?: unknown, field = 'companyId') {
    const f = await this.companyFilter(user, requested, field);
    const v = f[field];
    const ids: string[] = typeof v === 'string' ? [v] : v.$in;
    return {
      [field]: { $in: ids.flatMap((id) => [id, new Types.ObjectId(id)]) },
    };
  }

  async assertCompany(user: AuthUser, companyId: unknown): Promise<string> {
    const ids = await this.allowedCompanyIds(user);
    if (typeof companyId !== 'string' || !ids.includes(companyId)) {
      throw new ForbiddenException("Cette entreprise n'est pas accessible avec ce compte.");
    }
    return companyId;
  }

  /**
   * Which company a NEW record belongs to. Regular users: always their own
   * (a different value in the body is rejected). Super admins: must name one
   * of their own companies.
   */
  async companyForCreate(user: AuthUser, bodyCompanyId?: unknown): Promise<string> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!bodyCompanyId) {
        throw new BadRequestException('companyId est requis (une de vos entreprises).');
      }
      return this.assertCompany(user, bodyCompanyId);
    }
    if (!user.companyId) {
      throw new ForbiddenException("Aucune entreprise n'est associée à ce compte.");
    }
    if (bodyCompanyId && String(bodyCompanyId) !== String(user.companyId)) {
      throw new ForbiddenException("Cette entreprise n'est pas accessible avec ce compte.");
    }
    return String(user.companyId);
  }

  /**
   * Guards a document fetched by id. Answers 404 (not 403) so the API does
   * not confirm that a record exists in another company.
   */
  async assertOwns<T extends { companyId?: any }>(
    user: AuthUser,
    doc: T | null,
    notFoundMessage: string,
  ): Promise<T> {
    if (!doc) throw new NotFoundException(notFoundMessage);
    const ids = await this.allowedCompanyIds(user);
    if (!doc.companyId || !ids.includes(String(doc.companyId))) {
      throw new NotFoundException(notFoundMessage);
    }
    return doc;
  }

  /** Removes fields a client must never be able to set on update. */
  stripImmutable(dto: Record<string, any>): Record<string, any> {
    const { companyId: _c, _id: _i, createdBy: _b, createdAt: _ca, ...safe } = dto ?? {};
    return safe;
  }
}
