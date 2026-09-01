/**
 * Helpers tenant isolation for locations-ms (unit-testable without Nest DI).
 */
import {
  hasPlatformWideAccess,
  resolveJwtCompanyId as resolveJwtCompanyIdFromLib,
} from '@giurom/tenant-access';

export type LocationsAuthUser = {
  bypassAuth?: boolean;
  company_id?: number | null;
  companyId?: number | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
  roles?: string[];
};

/** Platform / global admin — may operate cross-company. Internal bypass stays separate. */
export function isPlatformWideLocationsUser(
  user?: LocationsAuthUser | null,
): boolean {
  if (!user) return false;
  if (user.bypassAuth === true) return true;
  return hasPlatformWideAccess(user);
}

export function resolveJwtCompanyId(
  user?: LocationsAuthUser | null,
): number | null {
  return resolveJwtCompanyIdFromLib(user);
}

/**
 * Non-platform: force company_id from JWT.
 * Platform: keep dto.company_id.
 * Returns the company_id that must be persisted, or throws if non-platform lacks JWT company.
 */
export function resolveCreateLocationCompanyId(
  dtoCompanyId: number | undefined | null,
  user?: LocationsAuthUser | null,
): number {
  if (!user || isPlatformWideLocationsUser(user)) {
    const n = Number(dtoCompanyId);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('ID-ul companiei este obligatoriu');
    }
    return n;
  }
  const jwtCompanyId = resolveJwtCompanyId(user);
  if (jwtCompanyId == null) {
    throw new Error('Compania utilizatorului nu este determinată');
  }
  return jwtCompanyId;
}

/** Effective company filter for list/batch (null = no filter / platform unscoped). */
export function resolveListCompanyFilter(
  requestedCompanyId: number | undefined | null,
  user?: LocationsAuthUser | null,
): { companyId: number | null; deny: boolean } {
  if (!user || isPlatformWideLocationsUser(user)) {
    const n = Number(requestedCompanyId);
    return {
      companyId: Number.isFinite(n) && n > 0 ? n : null,
      deny: false,
    };
  }
  const jwtCompanyId = resolveJwtCompanyId(user);
  if (jwtCompanyId == null) {
    return { companyId: null, deny: true };
  }
  if (
    requestedCompanyId != null &&
    Number(requestedCompanyId) > 0 &&
    Number(requestedCompanyId) !== jwtCompanyId
  ) {
    return { companyId: jwtCompanyId, deny: true };
  }
  return { companyId: jwtCompanyId, deny: false };
}
