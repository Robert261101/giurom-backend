import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      id: payload.id || payload.sub,
      username: payload.username,
      email: payload.email,
      first_name: payload.first_name || '',
      last_name: payload.last_name || '',
      permissions: payload.permissions || [],
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      // Required by PlanFeatureGuard → resolveJwtCompanyId (company_id wins over companyId).
      company_id:
        payload.company_id != null && Number.isFinite(Number(payload.company_id))
          ? Number(payload.company_id)
          : payload.companyId != null && Number.isFinite(Number(payload.companyId))
            ? Number(payload.companyId)
            : null,
    };
  }
}


