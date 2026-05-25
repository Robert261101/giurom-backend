import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    this.logger.log(`[JwtStrategy] JWT payload received: ${JSON.stringify(payload)}`);
    this.logger.log(`[JwtStrategy] Extracted permissions: ${JSON.stringify(payload.permissions || [])}`);
    this.logger.log(`[JwtStrategy] User work_location_id: ${payload.work_location_id}, work_location_default_id: ${payload.work_location_default_id}`);

    const user = {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      company_id:
        payload.company_id != null && Number.isFinite(Number(payload.company_id))
          ? Number(payload.company_id)
          : null,
      company_type:
        typeof payload.company_type === 'string' ? payload.company_type : null,
    };

    this.logger.log(`[JwtStrategy] Validated user: ${JSON.stringify(user)}`);
    return user;
  }
}