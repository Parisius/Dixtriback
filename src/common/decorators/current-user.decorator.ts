import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  companyId?: string | null;
  role: string;
  storeId?: string | null;
  regionId?: string | null;
}

/**
 * Pulls the authenticated user (as attached by JwtStrategy.validate) out of
 * the request. Use as @CurrentUser() user: AuthUser in any guarded route.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return data ? user?.[data] : user;
  },
);
