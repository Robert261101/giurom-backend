import { describe, expect, it } from '@jest/globals';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Behavioral tests for client-admin role assignment rules as enforced by UsersService helpers.
 * Uses a lightweight stub of the assertion surface (no Nest DI / DB).
 */
describe('client-admin role assignment scenarios', () => {
  type Requester = {
    sub?: number;
    id?: number;
    company_id?: number | null;
    roles?: string[];
    permissions?: string[];
  };

  const {
    getClientAdminAssignRoleBlockReason,
    isClientAdminRequester,
    CLIENT_ADMIN_ROLE_NAME,
    normalizeRoleName,
  } = require('./client-role-assignment.util') as typeof import('./client-role-assignment.util');

  function assertAssign(
    requester: Requester,
    target: { userId: number; employeeId: number; companyId: number },
    role: { name: string; permissions: string[] },
    opts?: { isSelf?: boolean; action?: 'assign' | 'remove' },
  ) {
    if (!isClientAdminRequester(requester)) {
      return; // platform path
    }
    const action = opts?.action ?? 'assign';
    const requesterEmp = Number(requester.sub ?? requester.id);
    if (
      action === 'remove' &&
      opts?.isSelf &&
      normalizeRoleName(role.name) === CLIENT_ADMIN_ROLE_NAME
    ) {
      throw new ForbiddenException(
        'Nu vă puteți elimina propriul rol client-admin',
      );
    }
    if (Number(requester.company_id) !== Number(target.companyId)) {
      throw new ForbiddenException('Acces interzis la resurse din altă companie');
    }
    if (action === 'assign') {
      const block = getClientAdminAssignRoleBlockReason({
        roleName: role.name,
        rolePermissionNames: role.permissions,
      });
      if (block) throw new ForbiddenException(block);
    }
  }

  const clientAdmin: Requester = {
    sub: 10,
    company_id: 1,
    roles: ['client-admin'],
    permissions: ['users.assign_role', 'users.create', 'assignment.read_company'],
  };

  it('PASS: assign angajat same company', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'angajat',
        permissions: ['assignment.read_own'],
      }),
    ).not.toThrow();
  });

  it('PASS: assign magazioner same company', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'magazioner',
        permissions: ['order.read'],
      }),
    ).not.toThrow();
  });

  it('PASS: assign sofer same company', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'sofer',
        permissions: ['order.read'],
      }),
    ).not.toThrow();
  });

  it('403: assign role user company 2', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 9, employeeId: 90, companyId: 2 }, {
        name: 'angajat',
        permissions: ['assignment.read_own'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('403: assign admin', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'admin',
        permissions: [],
      }),
    ).toThrow(/Nu puteți atribui/);
  });

  it('403: assign super-admin', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'super-admin',
        permissions: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('403: assign client-admin', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'client-admin',
        permissions: ['users.assign_role'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('403: assign furnizor', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'furnizor',
        permissions: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('403: assign role containing assignment.read_all', () => {
    expect(() =>
      assertAssign(clientAdmin, { userId: 2, employeeId: 20, companyId: 1 }, {
        name: 'angajat',
        permissions: ['assignment.read_all'],
      }),
    ).toThrow(/privilegiate/);
  });

  it('403: remove own client-admin', () => {
    expect(() =>
      assertAssign(
        clientAdmin,
        { userId: 1, employeeId: 10, companyId: 1 },
        { name: 'client-admin', permissions: [] },
        { action: 'remove', isSelf: true },
      ),
    ).toThrow(/propriul rol client-admin/);
  });

  it('regression: platform admin is not treated as client-admin gate', () => {
    const platform: Requester = {
      sub: 1,
      company_id: 1,
      roles: ['admin'],
      permissions: ['permissions.read', 'assignment.read_all'],
    };
    expect(isClientAdminRequester(platform)).toBe(false);
    expect(() =>
      assertAssign(platform, { userId: 2, employeeId: 20, companyId: 99 }, {
        name: 'admin',
        permissions: ['assignment.read_all'],
      }),
    ).not.toThrow();
  });
});
