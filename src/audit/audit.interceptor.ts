import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { Role } from '../common/constants/roles.enum';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const VERBS: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

const s = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));

/**
 * Records every write action and every auth event (login, register, OTP,
 * refresh, logout), successful or not. Reads (GET) are not logged.
 * Runs after the guards, so requests rejected for a missing/invalid token or
 * an insufficient role never reach it.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly prefix: string;

  constructor(
    private audit: AuditService,
    config: ConfigService,
  ) {
    this.prefix = config.get<string>('apiPrefix') || 'v1';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!WRITE_METHODS.has(req.method)) return next.handle();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap({
        next: (data) => this.write(req, res.statusCode, data, null),
        error: (err) => this.write(req, err?.status ?? 500, null, err),
      }),
    );
  }

  private write(req: any, statusCode: number, data: any, err: any) {
    try {
      const path = String(req.originalUrl || req.url).split('?')[0];
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === this.prefix) parts.shift();
      const [resource, second, third] = parts;
      if (!resource) return;

      const isAuth = resource === 'auth';
      const action = isAuth
        ? `auth.${parts.slice(1).join('.') || 'unknown'}`
        : `${resource}.${third ?? VERBS[req.method]}`;

      // Who: the authenticated user, or (login/register/OTP/refresh) the user in the response.
      const authUser = req.user ?? null;
      const respUser = data?.user ?? null;
      const actorId = authUser?.userId ?? s(respUser?._id ?? respUser?.id);
      const actorRole = authUser?.role ?? s(respUser?.role);
      const actorLabel = actorId ? null : s(typeof req.body?.email === 'string' ? req.body.email : null);

      // Which company: regular users are always logged against their own;
      // super admins against the company the action touched (or none).
      let companyId: string | null;
      if (authUser && authUser.role !== Role.SUPER_ADMIN && authUser.companyId) {
        companyId = String(authUser.companyId);
      } else {
        companyId =
          (resource === 'companies' ? s(data?._id) ?? s(second) : null) ??
          s(data?.companyId) ??
          s(respUser?.companyId) ??
          (typeof req.body?.companyId === 'string' ? s(req.body.companyId) : null) ??
          (typeof req.query?.companyId === 'string' ? s(req.query.companyId) : null) ??
          s(authUser?.companyId);
      }

      const resourceId = isAuth ? null : s(data?._id ?? data?.id) ?? s(second);

      this.audit.record({
        companyId,
        actorId,
        actorRole,
        actorLabel,
        action,
        resource,
        resourceId,
        method: req.method,
        path,
        statusCode,
        success: statusCode < 400,
        message: err ? String(err?.message ?? 'error').slice(0, 300) : null,
        ip: s(req.ip),
        userAgent: s(req.headers?.['user-agent'])?.slice(0, 200) ?? null,
        // Auth bodies hold passwords / OTP codes: keep only the email.
        body: isAuth
          ? typeof req.body?.email === 'string'
            ? { email: req.body.email }
            : null
          : this.audit.sanitize(req.body),
      });
    } catch {
      /* never let auditing break a request */
    }
  }
}
