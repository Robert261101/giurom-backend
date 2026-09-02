/**
 * Jest: npm test -- src/locations/locations-tenant.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  isPlatformWideLocationsUser,
  resolveCreateLocationCompanyId,
  resolveListCompanyFilter,
  resolveJwtCompanyId,
} from './locations-tenant.util';

describe('locations-tenant.util', () => {
  it('platform: assignment.read_all without company_id is global', () => {
    expect(
      isPlatformWideLocationsUser({ permissions: ['assignment.read_all'] }),
    ).toBe(true);
  });

  it('tenant assignment.read_all with company_id is NOT platform-wide', () => {
    expect(
      isPlatformWideLocationsUser({
        company_id: 1,
        permissions: ['assignment.read_all'],
      }),
    ).toBe(false);
  });

  it('assignment.read_company alone is NOT platform-wide', () => {
    expect(
      isPlatformWideLocationsUser({
        company_id: 1,
        permissions: ['assignment.read_company', 'locations.create'],
      }),
    ).toBe(false);
  });

  it('role admin without company_id is platform bypass', () => {
    expect(isPlatformWideLocationsUser({ roles: ['admin'] })).toBe(true);
  });

  it('tenant admin with company_id is NOT platform-wide', () => {
    expect(
      isPlatformWideLocationsUser({
        roles: ['admin'],
        company_id: 1,
      }),
    ).toBe(false);
  });

  it('tenant 1 cannot create location for tenant 2 (body company forced to JWT)', () => {
    const id = resolveCreateLocationCompanyId(2, {
      company_id: 1,
      permissions: ['locations.create'],
    });
    expect(id).toBe(1);
  });

  it('platform create keeps body company_id', () => {
    const id = resolveCreateLocationCompanyId(2, {
      permissions: ['assignment.read_all'],
    });
    expect(id).toBe(2);
  });

  it('list: non-platform without companyId filters to JWT company', () => {
    const r = resolveListCompanyFilter(undefined, {
      company_id: 1,
      permissions: ['locations.read'],
    });
    expect(r.deny).toBe(false);
    expect(r.companyId).toBe(1);
  });

  it('list: tenant 1 requesting tenant 2 is denied', () => {
    const r = resolveListCompanyFilter(2, {
      company_id: 1,
      permissions: ['locations.read'],
    });
    expect(r.deny).toBe(true);
  });

  it('list: platform may omit company filter', () => {
    const r = resolveListCompanyFilter(undefined, {
      permissions: ['assignment.read_all'],
    });
    expect(r.deny).toBe(false);
    expect(r.companyId).toBeNull();
  });

  it('resolveJwtCompanyId supports snake_case and camelCase', () => {
    expect(resolveJwtCompanyId({ company_id: 5 })).toBe(5);
    expect(resolveJwtCompanyId({ companyId: 7 })).toBe(7);
    expect(resolveJwtCompanyId({})).toBeNull();
  });

  it('bypassAuth is platform-wide independently of tenant-access', () => {
    expect(
      isPlatformWideLocationsUser({
        bypassAuth: true,
        company_id: 99,
        permissions: [],
      }),
    ).toBe(true);
  });
});
