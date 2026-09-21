import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

/**
 * Applied globally in AppModule (APP_GUARD). Every route requires a valid
 * JWT access token unless decorated with @Public() (never authenticated) or
 * @OptionalAuth() (authenticated only when a token is sent).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasToken = !!context.switchToHttp().getRequest().headers?.authorization;
    if (optional && !hasToken) return null; // anonymous visitor
    if (err || !user) throw err || new UnauthorizedException();
    return user;
  }
}
