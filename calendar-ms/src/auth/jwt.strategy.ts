import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const rawCompanyId = payload.company_id ?? payload.companyId;
    const companyId =
      rawCompanyId != null && Number.isFinite(Number(rawCompanyId))
        ? Number(rawCompanyId)
        : null;
    const user = {
      userId: payload.sub,
      sub: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
      roles: payload.roles || [],
      // Required by PlanFeatureGuard → resolveJwtCompanyId
      company_id: companyId,
      company_type: payload.company_type ?? undefined,
      position_default_id: payload.position_default_id ?? undefined,
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
    };

    this.logger.log(
      `JWT validated sub=${user.sub} company_id=${user.company_id} work_location_id=${user.work_location_id}`,
    );
    return user;
  }
}
