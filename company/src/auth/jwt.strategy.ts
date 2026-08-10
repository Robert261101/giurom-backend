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
    const permissions: string[] = Array.isArray(payload.permissions)
      ? payload.permissions
      : [];
    const permSet = new Set(
      permissions.map((p) => String(p).toLowerCase().trim()),
    );
    const rawType = String(payload.company_type ?? payload.companyType ?? '')
      .toLowerCase()
      .trim();
    const companyType =
      rawType === 'client' || rawType === 'furnizor' ? rawType : null;
    const rawCompanyId = payload.company_id ?? payload.companyId;
    const companyId =
      rawCompanyId != null && Number.isFinite(Number(rawCompanyId))
        ? Number(rawCompanyId)
        : null;

    // isAdmin/isSuperAdmin nu sunt în JWT ca flag-uri — se derivă din permisiuni.
    // Adminul de firmă (assignment.read_company) ≠ catalog platformă (assignment.read_all).
    const isSuperAdmin =
      payload.isSuperAdmin === true || permSet.has('assignment.read_all');
    const isAdmin =
      payload.isAdmin === true ||
      isSuperAdmin ||
      permSet.has('assignment.read_company');

    return {
      userId: payload.sub,
      id: payload.id || payload.sub || payload.employee_id,
      username: payload.username,
      email: payload.email,
      permissions,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      work_location_id: payload.work_location_id ?? undefined,
      work_location_default_id: payload.work_location_default_id ?? undefined,
      company_id: companyId,
      company_type: companyType,
      isAdmin,
      isSuperAdmin,
    };
  }
}
