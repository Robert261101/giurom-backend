import { describe, expect, it } from '@jest/globals';
import {
  filterUserRolesForRequester,
  hasPlatformRbacCatalogAccess,
  shouldListUserRolesGlobally,
} from './user-roles-list-scope.util';

describe('user-roles-list-scope.util', () => {
  const rows = [
    { id: 1, userId: 10, roleId: 100 }, // company 1
    { id: 2, userId: 11, roleId: 100 }, // company 1
    { id: 3, userId: 20, roleId: 100 }, // company 2, same role
    { id: 4, userId: 20, roleId: 200 }, // company 2
  ];
  const company1UserIds = new Set([10, 11]);

  it('client-admin company 1 sees only assignments for company 1 users', () => {
    const result = filterUserRolesForRequester(rows, {
      global: false,
      allowedUserIds: company1UserIds,
    });
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it('client-admin query userId from company 2 returns empty', () => {
    const result = filterUserRolesForRequester(rows, {
      global: false,
      allowedUserIds: company1UserIds,
      filters: { userId: 20 },
    });
    expect(result).toEqual([]);
  });

  it('client-admin query roleId shared with company 2 stays limited to company 1', () => {
    const result = filterUserRolesForRequester(rows, {
      global: false,
      allowedUserIds: company1UserIds,
      filters: { roleId: 100 },
    });
    expect(result.map((r) => r.id)).toEqual([1, 2]);
    expect(result.every((r) => company1UserIds.has(r.userId))).toBe(true);
  });

  it('platform admin / permissions.read lists globally', () => {
    expect(
      shouldListUserRolesGlobally({
        roles: ['admin'],
        permissions: ['permissions.read'],
      }),
    ).toBe(true);
    expect(
      shouldListUserRolesGlobally({
        roles: ['super-admin'],
        permissions: [],
      }),
    ).toBe(true);
    expect(
      shouldListUserRolesGlobally({
        roles: [],
        permissions: ['permissions.read'],
      }),
    ).toBe(true);
    expect(
      shouldListUserRolesGlobally({
        roles: [],
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);

    const result = filterUserRolesForRequester(rows, { global: true });
    expect(result).toHaveLength(4);
  });

  it('client-admin with users.assign_role is not global', () => {
    expect(
      shouldListUserRolesGlobally({
        roles: ['client-admin'],
        permissions: ['users.assign_role'],
      }),
    ).toBe(false);
  });

  it('tenant permissions.read with company_id is not global', () => {
    expect(
      shouldListUserRolesGlobally({
        permissions: ['permissions.read'],
        company_id: 15,
      }),
    ).toBe(false);
    expect(
      hasPlatformRbacCatalogAccess({
        permissions: ['permissions.read'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('platform operator permissions.read without company_id is global', () => {
    expect(
      shouldListUserRolesGlobally({
        permissions: ['permissions.read'],
      }),
    ).toBe(true);
    expect(
      hasPlatformRbacCatalogAccess({
        permissions: ['permissions.read'],
      }),
    ).toBe(true);
  });

  it('tenant admin with company_id is not global', () => {
    expect(
      shouldListUserRolesGlobally({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('tenant assignment.read_all with company_id is not global', () => {
    expect(
      shouldListUserRolesGlobally({
        permissions: ['assignment.read_all'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('platform operator without company_id lists globally via assignment.read_all', () => {
    expect(
      shouldListUserRolesGlobally({
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });

  it('empty allowed set yields empty list for tenant requester', () => {
    expect(
      filterUserRolesForRequester(rows, {
        global: false,
        allowedUserIds: new Set(),
      }),
    ).toEqual([]);
  });
});

describe('GET /users/user-roles access gate (assertCanAssignUserRoles semantics)', () => {
  function canAccess(perms: string[], isGlobal = false): boolean {
    if (isGlobal) return true;
    return (
      perms.includes('permissions.read') || perms.includes('users.assign_role')
    );
  }

  it('user without permissions.read and without users.assign_role is denied', () => {
    expect(canAccess(['users.read', 'users.create'])).toBe(false);
  });

  it('users.assign_role alone is allowed (then tenant-scoped)', () => {
    expect(canAccess(['users.assign_role'])).toBe(true);
    expect(
      shouldListUserRolesGlobally({
        permissions: ['users.assign_role'],
      }),
    ).toBe(false);
  });
});
