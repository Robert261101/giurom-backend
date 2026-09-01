/**
 * Pure helpers for employee tenant checks (unit-testable).
 * Rulare: npm test -- src/employee-tenant.util.test.ts
 */
import { hasPlatformWideAccess } from '@giurom/tenant-access';

export type EmployeeTenantUser = {
  bypassAuth?: boolean;
  company_id?: number | null;
  companyId?: number | null;
  isSuperAdmin?: boolean;
  permissions?: string[];
  roles?: string[];
};

export function isPlatformWideEmployeeUser(
  user?: EmployeeTenantUser | null,
): boolean {
  if (!user) return false;
  if (user.bypassAuth === true) return true;
  return hasPlatformWideAccess(user);
}

/** Returns true if non-platform must validate location against JWT company. */
export function mustValidateEmployeeLocationForUser(
  user?: EmployeeTenantUser | null,
): boolean {
  if (!user) return false;
  return !isPlatformWideEmployeeUser(user);
}

/** Internal S2S / platform operators may use unscoped batch lookup. */
export function isEmployeeBatchGlobalScope(
  user: EmployeeTenantUser | undefined,
  bypassAuth: boolean,
): boolean {
  if (bypassAuth) return true;
  return isPlatformWideEmployeeUser(user);
}

/** Tenant batch scope: company exclusively from JWT (never query/body). */
export function resolveEmployeeBatchTenantCompanyId(
  user: EmployeeTenantUser | undefined,
): number | null {
  const companyId = Number(user?.company_id ?? user?.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return null;
  }
  return companyId;
}
