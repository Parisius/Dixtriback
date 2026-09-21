import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { Role } from '../common/constants/roles.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';

const SENSITIVE_KEY = /pass|secret|token|hash|authorization|api[-_]?key/i;
const MAX_BODY_CHARS = 4000;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private tenancy: TenancyService,
  ) {}

  /** Fire-and-forget: a logging problem must never fail the user's request. */
  record(entry: Partial<AuditLog>): void {
    this.auditModel.create(entry).catch((err) => {
      this.logger.warn(`Could not write audit log: ${err?.message}`);
    });
  }

  /** Redacts secrets (recursively) and caps the size of what gets stored. */
  sanitize(body: unknown): Record<string, any> | null {
    if (!body || typeof body !== 'object') return null;
    const clean = (v: any, depth: number): any => {
      if (depth > 4) return '[…]';
      if (Array.isArray(v)) return v.slice(0, 50).map((i) => clean(i, depth + 1));
      if (v && typeof v === 'object') {
        return Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, SENSITIVE_KEY.test(k) ? '[REDACTED]' : clean(val, depth + 1)]),
        );
      }
      return v;
    };
    const out = clean(body, 0);
    const json = JSON.stringify(out);
    return json.length > MAX_BODY_CHARS ? { _truncated: true, preview: json.slice(0, MAX_BODY_CHARS) } : out;
  }

  // ---- Reading -------------------------------------------------------------

  private async scopeFilter(user: AuthUser, companyId: unknown): Promise<Record<string, any>> {
    if (user.role === Role.SUPER_ADMIN) {
      const c = str(companyId);
      if (!c) return {}; // every company + platform-level events
      return { companyId: c === 'none' ? null : c }; // "none" = platform-level events
    }
    // Company admins: their own company only, whatever they ask for.
    return this.tenancy.companyFilter(user, companyId);
  }

  async findAll(
    user: AuthUser,
    q: Record<string, unknown> & { page?: number; limit?: number },
  ) {
    const page = Math.max(Number(q.page) || 1, 1);
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const filter: Record<string, any> = {};

    const actorId = str(q.actorId);
    const resource = str(q.resource);
    const action = str(q.action);
    const method = str(q.method);
    if (actorId) filter.actorId = actorId;
    if (resource) filter.resource = resource;
    if (action) filter.action = action;
    if (method) filter.method = method.toUpperCase();
    if (q.success === 'true' || q.success === 'false') filter.success = q.success === 'true';

    const from = str(q.from);
    const to = str(q.to);
    if (from || to) {
      filter.createdAt = {};
      for (const [key, val, op] of [['from', from, '$gte'], ['to', to, '$lte']] as const) {
        if (!val) continue;
        const d = new Date(val);
        if (isNaN(d.getTime())) throw new BadRequestException(`Date invalide pour "${key}".`);
        filter.createdAt[op] = d;
      }
    }

    // Applied last so nothing the client sends can widen the company scope.
    Object.assign(filter, await this.scopeFilter(user, q.companyId));

    const [rows, total] = await Promise.all([
      this.auditModel.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean().exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return { data: await this.withActors(rows), total, page, limit };
  }

  async findById(user: AuthUser, id: string) {
    const log = await this.auditModel.findById(id).lean().exec();
    if (!log) throw new NotFoundException('Entrée de journal introuvable');
    if (user.role !== Role.SUPER_ADMIN) {
      const ids = await this.tenancy.allowedCompanyIds(user);
      if (!log.companyId || !ids.includes(log.companyId)) {
        throw new NotFoundException('Entrée de journal introuvable');
      }
    }
    return (await this.withActors([log]))[0];
  }

  /** Attaches the actor's name/email so the log is readable without extra calls. */
  private async withActors(rows: any[]) {
    const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean))];
    const users = ids.length
      ? await this.userModel.find({ _id: { $in: ids } }).select('name email role').lean().exec()
      : [];
    const byId = new Map(users.map((u: any) => [String(u._id), u]));
    return rows.map((r) => {
      const u: any = r.actorId ? byId.get(r.actorId) : null;
      return {
        ...r,
        actor: u
          ? { id: r.actorId, name: u.name, email: u.email, role: r.actorRole ?? u.role }
          : { id: r.actorId, name: null, email: r.actorLabel, role: r.actorRole },
      };
    });
  }
}
