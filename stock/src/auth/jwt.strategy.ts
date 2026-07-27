import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

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
    // sub din auth este id_employee; id și employee_id sunt folosite în controller-e (ex. waste-requests)
    const sub = payload.sub;
    return {
      id: sub,
      userId: sub,
      employee_id: sub,
      username: payload.username,
      permissions: payload.permissions || [],
      roles: payload.roles || [],
      company_id: payload.company_id ?? undefined,
      company_type: payload.company_type ?? undefined,
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
    };
  }
}


