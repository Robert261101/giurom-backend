import { TenantScopeViolationError } from './tenant-access.errors';
import type {
  PlatformSubscriptionAdminRequester,
  TenantAccessUser,
} from './tenant-access.types';

function normalizeRoles(roles?: string[] | null): string[] {
  return (Array.isArray(roles) ? roles : []).map((role) =>
    String(role).toLowerCase().trim(),
  );
}

function normalizePermissions(permissions?: string[] | null): string[] {
  return (Array.isArray(permissions) ? permissions : []).map((perm) =>
    String(perm).toLowerCase().trim(),
  );
}

function hasSuperAdminRole(roles: string[]): boolean {
  return roles.includes('super-admin') || roles.includes('superadmin');
}

/**
 * Resolves tenant company id from JWT payload.
 * Accepts `company_id` (snake_case) or `companyId` (camelCase).
 */
export function resolveJwtCompanyId(
  user?: TenantAccessUser | null,
): number | null {
  if (!user) return null;
  const raw = user.company_id ?? user.companyId;
  const companyId = Number(raw);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

/**
 * Cross-tenant / platform-wide access.
 *
 * Rules (aligned with suppliers-ms `hasPlatformWideSupplierAccess`):
 * - `isSuperAdmin` => platform-wide (even with bound `company_id`)
 * - role `super-admin` / `superadmin` => platform-wide (even with bound `company_id`)
 * - any `company_id > 0` => NOT platform-wide (blocks `admin` / `assignment.read_all`)
 * - unbound requester + `assignment.read_all` => platform-wide
 * - unbound requester + role `admin` => platform-wide
 *
 * Intentionally does NOT treat `assignment.read_company` as global bypass.
 */
export function hasPlatformWideAccess(
  user?: TenantAccessUser | null,
): boolean {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;

  const roles = normalizeRoles(user.roles);
  if (hasSuperAdminRole(roles)) {
    return true;
  }

  const companyId = resolveJwtCompanyId(user);
  if (companyId != null) {
    return false;
  }

  const permissions = normalizePermissions(user.permissions);
  if (permissions.includes('assignment.read_all')) {
    return true;
  }
  if (roles.includes('admin')) {
    return true;
  }
  return false;
}

/**
 * True when the caller is a real non-platform tenant (`company_id > 0` on JWT).
 * Empty/internal requesters are NOT tenant-scoped.
 */
export function isTenantScopedRequester(
  user?: TenantAccessUser | null,
): boolean {
  if (!user) return false;
  if (hasPlatformWideAccess(user)) return false;
  return resolveJwtCompanyId(user) != null;
}

/**
 * Resolves the effective tenant `company_id` for an operation.
 *
 * - Platform operator (`hasPlatformWideAccess`): must supply a valid `dtoCompanyId`.
 * - Tenant-scoped requester: always returns JWT `company_id`.
 *   If `dtoCompanyId` is present and differs from JWT => **reject** (`TenantScopeViolationError`).
 *   Matching or absent `dtoCompanyId` => JWT value (ignore DTO when equal; absent is OK).
 *
 * Reject (not ignore) on mismatch: prevents scope escalation via client-supplied ids and
 * matches locations-ms `resolveListCompanyFilter` (`deny: true` on foreign company).
 */
export function assertTenantCompanyId(
  user?: TenantAccessUser | null,
  dtoCompanyId?: number | null,
): number {
  if (hasPlatformWideAccess(user)) {
    const requested = Number(dtoCompanyId);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new TenantScopeViolationError('ID-ul companiei este obligatoriu');
    }
    return requested;
  }

  const jwtCompanyId = resolveJwtCompanyId(user);
  if (jwtCompanyId == null) {
    throw new TenantScopeViolationError(
      'Compania utilizatorului nu este determinată',
    );
  }

  if (dtoCompanyId != null && dtoCompanyId !== undefined) {
    const requested = Number(dtoCompanyId);
    if (
      Number.isFinite(requested) &&
      requested > 0 &&
      requested !== jwtCompanyId
    ) {
      throw new TenantScopeViolationError(
        'Nu poți opera pe o companie diferită de tenant-ul autentificat',
      );
    }
  }

  return jwtCompanyId;
}

/**
 * Platform subscription admin — `PATCH /companies/:companyId/subscription` etc.
 *
 * Source of truth: company-ms `subscription.constants.ts` + its unit test
 * `blocks tenant admin with company_id from platform subscription admin`.
 *
 * **Intentionally stricter than `hasPlatformWideAccess` for bound tenants:**
 * if `resolveJwtCompanyId(requester)` returns a value, the caller is treated as
 * tenant-scoped for subscription admin — even when `isSuperAdmin`, role
 * `super-admin`, or `hasPlatformWideAccess` are also set. This guards against
 * mis-bound JWTs (e.g. platform flags + employee `company_id` from location).
 *
 * Real platform operators are expected to have no tenant `company_id` on JWT
 * (`buildUserDataForToken` only sets `company_id` from employee location).
 *
 * Unlike `hasPlatformWideAccess`, `isSuperAdmin` / `super-admin` do **not**
 * bypass a bound tenant company id here.
 */
export function isPlatformSubscriptionAdmin(
  requester?: PlatformSubscriptionAdminRequester | null,
): boolean {
  if (!requester) return false;

  if (resolveJwtCompanyId(requester) != null) {
    return false;
  }

  if (requester.isSuperAdmin === true) return true;
  if (requester.hasPlatformWideAccess === true) return true;

  const permissions = normalizePermissions(requester.permissions);
  if (permissions.includes('assignment.read_all')) return true;

  const roles = normalizeRoles(requester.roles);
  if (roles.includes('admin') || hasSuperAdminRole(roles)) {
    return true;
  }

  return false;
}

/**
 * Alias kept for suppliers-ms migration (PR-1.1).
 * Same semantics as `hasPlatformWideAccess`.
 */
export const hasPlatformWideSupplierAccess = hasPlatformWideAccess;

/**
 * Alias kept for suppliers-ms migration (PR-1.1).
 * Same semantics as `isTenantScopedRequester`.
 */
export const isTenantScopedSupplierRequester = isTenantScopedRequester;
