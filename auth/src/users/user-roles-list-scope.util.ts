/**
 * Tenant scope helpers for GET /users/user-roles listing.
 */
import {
  hasPlatformWideAccess,
  resolveJwtCompanyId,
} from '@giurom/tenant-access';

export type UserRoleListRow = {
  id?: number;
  userId: number;
  roleId: number;
};

export type UserRolesListFilters = {
  userId?: number | null;
  roleId?: number | null;
};

export type UserRolesListRequester = {
  roles?: string[];
  permissions?: string[];
  company_id?: number | null;
  companyId?: number | null;
  isSuperAdmin?: boolean;
};

/**
 * Platform RBAC catalog access via `permissions.read`.
 * Tenant-bound JWT (`company_id > 0`) never qualifies — even with permissions.read.
 */
export function hasPlatformRbacCatalogAccess(
  requester?: UserRolesListRequester | null,
): boolean {
  if (!requester) return false;
  const perms = requester.permissions || [];
  if (!perms.includes('permissions.read')) return false;
  return resolveJwtCompanyId(requester) == null;
}

/**
 * Global user_roles list:
 * - internal calls
 * - platform operators (`hasPlatformWideAccess`)
 * - unbound `permissions.read` (platform RBAC catalog)
 *
 * Tenant client-admin uses `users.assign_role` and stays company-scoped.
 */
export function shouldListUserRolesGlobally(
  requester?: UserRolesListRequester | null,
  isInternal = false,
): boolean {
  if (isInternal) return true;
  if (!requester) return false;
  if (hasPlatformWideAccess(requester)) return true;
  return hasPlatformRbacCatalogAccess(requester);
}

/**
 * Apply tenant allowlist then optional userId/roleId filters.
 * Filters never expand the set beyond allowedUserIds when scoping.
 */
export function filterUserRolesForRequester(
  rows: UserRoleListRow[],
  opts: {
    global: boolean;
    allowedUserIds?: ReadonlySet<number> | null;
    filters?: UserRolesListFilters;
  },
): UserRoleListRow[] {
  let out = rows;
  if (!opts.global) {
    const allowed = opts.allowedUserIds;
    if (!allowed || allowed.size === 0) {
      return [];
    }
    out = out.filter((row) => allowed.has(Number(row.userId)));
  }

  const userId = opts.filters?.userId;
  if (userId != null && Number.isFinite(Number(userId)) && Number(userId) > 0) {
    const uid = Number(userId);
    out = out.filter((row) => Number(row.userId) === uid);
  }

  const roleId = opts.filters?.roleId;
  if (roleId != null && Number.isFinite(Number(roleId)) && Number(roleId) > 0) {
    const rid = Number(roleId);
    out = out.filter((row) => Number(row.roleId) === rid);
  }

  return out;
}
