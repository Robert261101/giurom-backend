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
      sub: payload.sub,
      userId: payload.sub,
      id: payload.id,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      company_type: payload.company_type ?? null,
      company_id: payload.company_id ?? null,
      position_default_id: payload.position_default_id ?? null,
      employee_id: payload.employee_id,
      id_employee: payload.id_employee,
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
    };
  }
}