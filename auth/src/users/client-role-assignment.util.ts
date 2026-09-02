/**
 * Pure helpers for tenant-safe user↔role assignment (client-admin V1).
 */

export const CLIENT_ADMIN_ROLE_NAME = 'client-admin';

/** Roles a client-admin may assign to users in their own company (V1). */
export const CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES = [
  'angajat',
  'employee',
  'magazioner',
  'sofer',
] as const;

/** System / privileged roles never assignable by client-admin. */
export const CLIENT_ADMIN_DENIED_ROLE_NAMES = [
  'admin',
  'super-admin',
  'superadmin',
  'client-admin',
  'furnizor',
] as const;

/** Permissions that mark a role as too privileged for client-admin to assign. */
export const CLIENT_ADMIN_PRIVILEGED_PERMISSIONS = [
  'assignment.read_all',
  'execution.read_all',
  'companies.read',
  'companies.create',
  'permissions.read',
  'permissions.assign',
  'users.assign_role',
] as const;

export function normalizeRoleName(name: string | null | undefined): string {
  return String(name ?? '')
    .toLowerCase()
    .trim();
}

export function isClientAdminRequester(requester?: {
  roles?: string[];
  permissions?: string[];
} | null): boolean {
  if (!requester) return false;
  const roles = (requester.roles || []).map(normalizeRoleName);
  if (roles.includes(CLIENT_ADMIN_ROLE_NAME)) return true;
  // Tenant admins that only have assign_role (not permissions.read / platform)
  const perms = requester.permissions || [];
  return (
    perms.includes('users.assign_role') &&
    !perms.includes('permissions.read') &&
    !perms.includes('assignment.read_all')
  );
}

export function isDeniedRoleNameForClientAdmin(roleName: string): boolean {
  const n = normalizeRoleName(roleName);
  return (CLIENT_ADMIN_DENIED_ROLE_NAMES as readonly string[]).includes(n);
}

export function isAllowlistedRoleNameForClientAdmin(roleName: string): boolean {
  const n = normalizeRoleName(roleName);
  return (CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES as readonly string[]).includes(n);
}

export function roleHasPrivilegedPermission(
  permissionNames: string[],
): boolean {
  const set = new Set(
    permissionNames.map((p) => String(p).toLowerCase().trim()),
  );
  for (const privileged of CLIENT_ADMIN_PRIVILEGED_PERMISSIONS) {
    if (set.has(privileged)) return true;
  }
  // Any *read_all is platform-wide
  for (const name of set) {
    if (name.endsWith('.read_all') || name.endsWith('_read_all')) {
      return true;
    }
  }
  return false;
}

/**
 * Returns an error message if client-admin must not assign this role; null if OK.
 */
export function getClientAdminAssignRoleBlockReason(input: {
  roleName: string;
  rolePermissionNames: string[];
}): string | null {
  const { roleName, rolePermissionNames } = input;
  if (isDeniedRoleNameForClientAdmin(roleName)) {
    return `Nu puteți atribui rolul „${normalizeRoleName(roleName)}”`;
  }
  if (!isAllowlistedRoleNameForClientAdmin(roleName)) {
    return `Rolul „${normalizeRoleName(roleName)}” nu este permis pentru atribuire`;
  }
  if (roleHasPrivilegedPermission(rolePermissionNames)) {
    return `Rolul „${normalizeRoleName(roleName)}” conține permisiuni privilegiate`;
  }
  return null;
}
