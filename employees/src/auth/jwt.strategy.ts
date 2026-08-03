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
      id: payload.id || payload.id_employee || payload.sub, // id_employee din JWT
      id_employee: payload.id_employee || payload.id || payload.sub,
      username: payload.username,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      permissions: payload.permissions || [],
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      company_type:
        typeof payload.company_type === 'string' ? payload.company_type : null,
      company_id:
        payload.company_id != null && Number.isFinite(Number(payload.company_id))
          ? Number(payload.company_id)
          : null,
    };
  }
}


