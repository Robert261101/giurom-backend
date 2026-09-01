import { describe, expect, it } from '@jest/globals';
import {
  CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES,
  CLIENT_ADMIN_DENIED_ROLE_NAMES,
  getClientAdminAssignRoleBlockReason,
  isAllowlistedRoleNameForClientAdmin,
  isClientAdminRequester,
  isDeniedRoleNameForClientAdmin,
  roleHasPrivilegedPermission,
} from './client-role-assignment.util';

describe('client-role-assignment.util', () => {
  it('allowlists angajat / magazioner / sofer', () => {
    expect(isAllowlistedRoleNameForClientAdmin('angajat')).toBe(true);
    expect(isAllowlistedRoleNameForClientAdmin('Magazioner')).toBe(true);
    expect(isAllowlistedRoleNameForClientAdmin('sofer')).toBe(true);
    expect(CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES).toEqual(
      expect.arrayContaining(['angajat', 'magazioner', 'sofer']),
    );
  });

  it('denies admin / super-admin / client-admin / furnizor', () => {
    for (const name of CLIENT_ADMIN_DENIED_ROLE_NAMES) {
      expect(isDeniedRoleNameForClientAdmin(name)).toBe(true);
      expect(
        getClientAdminAssignRoleBlockReason({
          roleName: name,
          rolePermissionNames: [],
        }),
      ).toMatch(/Nu puteți atribui|nu este permis/i);
    }
  });

  it('blocks roles with assignment.read_all via privilege ceiling', () => {
    expect(roleHasPrivilegedPermission(['assignment.read_all'])).toBe(true);
    expect(
      getClientAdminAssignRoleBlockReason({
        roleName: 'angajat',
        rolePermissionNames: ['assignment.read_own', 'assignment.read_all'],
      }),
    ).toMatch(/privilegiate/i);
  });

  it('allows clean allowlisted role', () => {
    expect(
      getClientAdminAssignRoleBlockReason({
        roleName: 'angajat',
        rolePermissionNames: ['assignment.read_own', 'execution.read_own'],
      }),
    ).toBeNull();
  });

  it('detects client-admin requester by role or users.assign_role', () => {
    expect(
      isClientAdminRequester({
        roles: ['client-admin'],
        permissions: ['users.assign_role'],
      }),
    ).toBe(true);
    expect(
      isClientAdminRequester({
        roles: [],
        permissions: ['users.assign_role'],
      }),
    ).toBe(true);
    expect(
      isClientAdminRequester({
        roles: ['admin'],
        permissions: ['permissions.read', 'users.assign_role', 'assignment.read_all'],
      }),
    ).toBe(false);
  });

  it('blocks non-allowlisted role names', () => {
    expect(
      getClientAdminAssignRoleBlockReason({
        roleName: 'verificator',
        rolePermissionNames: [],
      }),
    ).toMatch(/nu este permis/i);
  });
});
