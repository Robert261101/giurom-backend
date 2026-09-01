/**
 * Jest: npm test -- src/employee-tenant.batch.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  isEmployeeBatchGlobalScope,
  isPlatformWideEmployeeUser,
  resolveEmployeeBatchTenantCompanyId,
} from './employee-tenant.util';

describe('employee batch tenant scope', () => {
  it('tenant normal resolves company from JWT only', () => {
    expect(
      isEmployeeBatchGlobalScope({ company_id: 10, roles: ['user'] }, false),
    ).toBe(false);
    expect(resolveEmployeeBatchTenantCompanyId({ company_id: 10 })).toBe(10);
  });

  it('cross-tenant: tenant A cannot use global batch scope', () => {
    expect(
      isEmployeeBatchGlobalScope(
        { company_id: 10, permissions: ['order.read'] },
        false,
      ),
    ).toBe(false);
    expect(resolveEmployeeBatchTenantCompanyId({ company_id: 10 })).toBe(10);
    expect(resolveEmployeeBatchTenantCompanyId({ company_id: 20 })).toBe(20);
  });

  it('admin + company_id=A is NOT platform-wide (B1 inaccessible via global path)', () => {
    expect(
      isPlatformWideEmployeeUser({ roles: ['admin'], company_id: 10 }),
    ).toBe(false);
    expect(
      isEmployeeBatchGlobalScope({ roles: ['admin'], company_id: 10 }, false),
    ).toBe(false);
  });

  it('assignment.read_all + company_id=A is NOT platform-wide', () => {
    expect(
      isPlatformWideEmployeeUser({
        permissions: ['assignment.read_all'],
        company_id: 10,
      }),
    ).toBe(false);
    expect(
      isEmployeeBatchGlobalScope(
        { permissions: ['assignment.read_all'], company_id: 10 },
        false,
      ),
    ).toBe(false);
  });

  it('platform operator without company_id keeps global batch scope', () => {
    expect(isEmployeeBatchGlobalScope({ roles: ['admin'] }, false)).toBe(true);
    expect(
      isEmployeeBatchGlobalScope(
        { permissions: ['assignment.read_all'] },
        false,
      ),
    ).toBe(true);
    expect(resolveEmployeeBatchTenantCompanyId({ roles: ['admin'] })).toBeNull();
  });

  it('bypassAuth keeps global batch scope for internal S2S', () => {
    expect(isEmployeeBatchGlobalScope(undefined, true)).toBe(true);
  });

  it('tenant without company_id cannot resolve batch company', () => {
    expect(
      resolveEmployeeBatchTenantCompanyId({ permissions: ['employees.read'] }),
    ).toBeNull();
  });
});
