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
      id: payload.id || payload.sub || payload.employee_id,
      employee_id: payload.employee_id || payload.id || payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
      // Păstrăm și alte câmpuri din payload pentru compatibilitate
      ...payload,
    };
  }
}