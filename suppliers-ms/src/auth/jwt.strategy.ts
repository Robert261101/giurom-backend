import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveCompanyTypeFromAuth } from '../suppliers/supplier-product-access';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET nu este configurat în variabilele de mediu');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const roles = Array.isArray(payload.roles)
      ? payload.roles.map((role: unknown) => String(role))
      : [];

    const user = {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
      roles,
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      company_id:
        payload.company_id != null && Number.isFinite(Number(payload.company_id))
          ? Number(payload.company_id)
          : null,
      company_type: resolveCompanyTypeFromAuth(payload.company_type, roles),
      isAdmin: payload.isAdmin === true,
      isSuperAdmin: payload.isSuperAdmin === true,
    };

    return user;
  }
}