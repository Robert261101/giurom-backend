import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      position_default_id: payload.position_default_id ?? undefined,
      company_id:
        payload.company_id != null && Number.isFinite(Number(payload.company_id))
          ? Number(payload.company_id)
          : null,
      company_type:
        typeof payload.company_type === 'string' ? payload.company_type : null,
      employee_id: payload.sub ?? payload.employee_id ?? payload.id_employee,
      id_employee: payload.id_employee ?? payload.sub,
      sub: payload.sub,
    };
  }
}


