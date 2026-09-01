/**
 * Jest: npm test -- src/employee-tenant.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  isPlatformWideEmployeeUser,
  mustValidateEmployeeLocationForUser,
} from './employee-tenant.util';

describe('employee-tenant.util', () => {
  it('assignment.read_all without company_id is platform-wide', () => {
    expect(
      isPlatformWideEmployeeUser({ permissions: ['assignment.read_all'] }),
    ).toBe(true);
  });

  it('assignment.read_all with company_id is NOT platform-wide', () => {
    expect(
      isPlatformWideEmployeeUser({
        permissions: ['assignment.read_all'],
        company_id: 15,
      }),
    ).toBe(false);
  });

  it('assignment.read_company alone is NOT platform-wide (cross-tenant GET blocked)', () => {
    expect(
      isPlatformWideEmployeeUser({
        permissions: ['assignment.read_company', 'employees.create'],
      }),
    ).toBe(false);
    expect(
      mustValidateEmployeeLocationForUser({
        permissions: ['assignment.read_company'],
      }),
    ).toBe(true);
  });

  it('create/update on foreign location requires validation for tenant user', () => {
    expect(
      mustValidateEmployeeLocationForUser({
        permissions: ['employees.create', 'employees.update'],
      }),
    ).toBe(true);
  });

  it('role admin without company_id remains platform bypass', () => {
    expect(isPlatformWideEmployeeUser({ roles: ['admin'] })).toBe(true);
    expect(mustValidateEmployeeLocationForUser({ roles: ['admin'] })).toBe(
      false,
    );
  });

  it('tenant admin with company_id is NOT platform-wide', () => {
    expect(
      isPlatformWideEmployeeUser({
        roles: ['admin'],
        company_id: 1,
      }),
    ).toBe(false);
    expect(
      mustValidateEmployeeLocationForUser({
        roles: ['admin'],
        company_id: 1,
      }),
    ).toBe(true);
  });

  it('bypassAuth is platform-wide but is not hasPlatformWideAccess', () => {
    expect(isPlatformWideEmployeeUser({ bypassAuth: true })).toBe(true);
  });
});
