import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  role: string;
  companyId?: string | null;
  storeId?: string | null;
  regionId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  /** Return value is attached to request.user, i.e. what @CurrentUser() reads. */
  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      role: payload.role,
      companyId: payload.companyId ?? null,
      storeId: payload.storeId ?? null,
      regionId: payload.regionId ?? null,
    };
  }
}
