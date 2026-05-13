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
    };

    this.logger.log(`[JwtStrategy] Validated user: ${JSON.stringify(user)}`);
    return user;
  }
}