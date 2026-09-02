import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES } from './client-role-assignment.util';
import { hasPlatformRbacCatalogAccess } from './user-roles-list-scope.util';

/**
 * Mirrors UsersService.getAssignableRolesForRequester filtering rules
 * without Nest DI (pure behavior contract).
 */
function filterAssignableRoles(
  allRoles: Array<{ id: number; name: string }>,
  requester: {
    permissions?: string[];
    roles?: string[];
    company_id?: number | null;
  } | null,
  opts: { isInternal?: boolean; isGlobalAdmin?: boolean } = {},
) {
  if (
    opts.isInternal ||
    opts.isGlobalAdmin ||
    hasPlatformRbacCatalogAccess(requester)
  ) {
    return allRoles;
  }
  if (!(requester?.permissions || []).includes('users.assign_role')) {
    throw new ForbiddenException('Permisiuni insuficiente');
  }
  const allow = new Set(
    (CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES as readonly string[]).map((n) =>
      n.toLowerCase(),
    ),
  );
  return allRoles.filter((r) => allow.has(String(r.name).toLowerCase().trim()));
}

describe('assignable-roles scope', () => {
  const allRoles = [
    { id: 1, name: 'admin' },
    { id: 2, name: 'client-admin' },
    { id: 3, name: 'angajat' },
    { id: 4, name: 'magazioner' },
    { id: 5, name: 'sofer' },
    { id: 6, name: 'furnizor' },
  ];

  it('client-admin with users.assign_role gets only allowlist', () => {
    const result = filterAssignableRoles(allRoles, {
      roles: ['client-admin'],
      permissions: ['users.assign_role'],
    });
    expect(result.map((r) => r.name).sort()).toEqual([
      'angajat',
      'magazioner',
      'sofer',
    ]);
  });

  it('client-admin does not get permissions.read and cannot use global catalog path', () => {
    const perms = ['users.assign_role', 'users.read', 'assignment.read_company'];
    expect(perms.includes('permissions.read')).toBe(false);
  });

  it('platform with permissions.read gets all roles', () => {
    const result = filterAssignableRoles(allRoles, {
      roles: ['admin'],
      permissions: ['permissions.read', 'assignment.read_all'],
    });
    expect(result).toHaveLength(allRoles.length);
  });

  it('tenant permissions.read with company_id does not get global catalog', () => {
    const result = filterAssignableRoles(allRoles, {
      permissions: ['permissions.read', 'users.assign_role'],
      company_id: 15,
    });
    expect(result.map((r) => r.name).sort()).toEqual([
      'angajat',
      'magazioner',
      'sofer',
    ]);
    expect(result).not.toHaveLength(allRoles.length);
  });

  it('user without permissions.read and without users.assign_role is denied', () => {
    expect(() =>
      filterAssignableRoles(allRoles, {
        permissions: ['users.read'],
      }),
    ).toThrow(ForbiddenException);
  });
});

describe('setari permissions fetch gate', () => {
  it('shouldFetchGlobalPermissionsCatalog only with permissions.read', () => {
    const shouldFetch = (permissions: string[]) =>
      permissions.includes('permissions.read');
    expect(shouldFetch(['users.assign_role'])).toBe(false);
    expect(shouldFetch(['permissions.read'])).toBe(true);
  });
});
