/**
 * Jest: npm run test:libs:tenant-access  (from giurom-backend root)
 *   or: npm test --prefix libs/tenant-access
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertTenantCompanyId,
  hasPlatformWideAccess,
  isPlatformSubscriptionAdmin,
  isTenantScopedRequester,
  resolveJwtCompanyId,
} from './tenant-access';
import { TenantScopeViolationError } from './tenant-access.errors';

describe('resolveJwtCompanyId', () => {
  it('returns company_id when positive', () => {
    expect(resolveJwtCompanyId({ company_id: 5 })).toBe(5);
  });

  it('returns companyId (camelCase) when positive', () => {
    expect(resolveJwtCompanyId({ companyId: 7 })).toBe(7);
  });

  it('prefers company_id over companyId when both set', () => {
    expect(resolveJwtCompanyId({ company_id: 3, companyId: 9 })).toBe(3);
  });

  it.each([null, undefined, 0, -1, NaN, ''])(
    'returns null for invalid company id %#',
    (value) => {
      expect(resolveJwtCompanyId({ company_id: value as number })).toBeNull();
      expect(resolveJwtCompanyId({ companyId: value as number })).toBeNull();
      expect(resolveJwtCompanyId(null)).toBeNull();
      expect(resolveJwtCompanyId(undefined)).toBeNull();
      expect(resolveJwtCompanyId({})).toBeNull();
    },
  );
});

describe('hasPlatformWideAccess', () => {
  it('admin + company_id => tenant-scoped (NOT platform)', () => {
    expect(
      hasPlatformWideAccess({
        roles: ['admin'],
        company_id: 15,
        company_type: 'client',
      } as never),
    ).toBe(false);
  });

  it('admin without company_id => platform-wide', () => {
    expect(hasPlatformWideAccess({ roles: ['admin'] })).toBe(true);
  });

  it('assignment.read_all + company_id => tenant-scoped', () => {
    expect(
      hasPlatformWideAccess({
        permissions: ['assignment.read_all'],
        company_id: 1,
      }),
    ).toBe(false);
  });

  it('assignment.read_all without company_id => platform-wide', () => {
    expect(
      hasPlatformWideAccess({ permissions: ['assignment.read_all'] }),
    ).toBe(true);
  });

  it('assignment.read_all is case-insensitive', () => {
    expect(
      hasPlatformWideAccess({ permissions: ['Assignment.Read_All'] }),
    ).toBe(true);
  });

  it('isSuperAdmin => platform-wide even with company_id', () => {
    expect(
      hasPlatformWideAccess({
        isSuperAdmin: true,
        company_id: 1,
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });

  it('role super-admin => platform-wide even with company_id', () => {
    expect(
      hasPlatformWideAccess({
        roles: ['super-admin'],
        company_id: 1,
      }),
    ).toBe(true);
  });

  it('role superadmin => platform-wide even with company_id', () => {
    expect(
      hasPlatformWideAccess({
        roles: ['superadmin'],
        company_id: 99,
      }),
    ).toBe(true);
  });

  it('admin@giurom.ro shape stays tenant-scoped', () => {
    expect(
      hasPlatformWideAccess({
        roles: ['admin'],
        company_id: 1,
        permissions: ['assignment.read_all', 'assignment.read_company'],
      }),
    ).toBe(false);
  });

  it('assignment.read_company alone is NOT platform-wide', () => {
    expect(
      hasPlatformWideAccess({
        permissions: ['assignment.read_company', 'suppliers.read'],
      }),
    ).toBe(false);
  });

  it('normal user + company_id => NOT platform-wide', () => {
    expect(
      hasPlatformWideAccess({
        company_id: 42,
        permissions: ['suppliers.read'],
      }),
    ).toBe(false);
  });

  it('normal user without company_id => NOT platform-wide', () => {
    expect(
      hasPlatformWideAccess({
        permissions: ['suppliers.read'],
      }),
    ).toBe(false);
  });

  it('null/undefined requester => NOT platform-wide', () => {
    expect(hasPlatformWideAccess(null)).toBe(false);
    expect(hasPlatformWideAccess(undefined)).toBe(false);
  });
});

describe('isTenantScopedRequester', () => {
  it('company_id > 0 and non-platform => tenant-scoped', () => {
    expect(
      isTenantScopedRequester({
        company_id: 15,
        permissions: ['assignment.read_company'],
      }),
    ).toBe(true);
  });

  it('admin + company_id => tenant-scoped', () => {
    expect(
      isTenantScopedRequester({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(true);
  });

  it('admin without company_id => NOT tenant-scoped', () => {
    expect(isTenantScopedRequester({ roles: ['admin'] })).toBe(false);
  });

  it('isSuperAdmin + company_id => NOT tenant-scoped (platform)', () => {
    expect(
      isTenantScopedRequester({
        isSuperAdmin: true,
        company_id: 1,
      }),
    ).toBe(false);
  });

  it('no company_id => NOT tenant-scoped', () => {
    expect(isTenantScopedRequester({ company_id: null })).toBe(false);
    expect(isTenantScopedRequester({})).toBe(false);
    expect(isTenantScopedRequester(null)).toBe(false);
  });
});

describe('assertTenantCompanyId', () => {
  it('tenant: returns JWT company_id when dto absent', () => {
    expect(assertTenantCompanyId({ company_id: 16 })).toBe(16);
  });

  it('tenant: returns JWT when dto equals JWT', () => {
    expect(assertTenantCompanyId({ company_id: 16 }, 16)).toBe(16);
  });

  it('tenant: rejects when dto differs from JWT', () => {
    expect(() =>
      assertTenantCompanyId({ company_id: 16 }, 99),
    ).toThrow(TenantScopeViolationError);
    expect(() =>
      assertTenantCompanyId({ company_id: 16 }, 99),
    ).toThrow(
      'Nu poți opera pe o companie diferită de tenant-ul autentificat',
    );
  });

  it('tenant: throws when JWT company missing', () => {
    expect(() => assertTenantCompanyId({ roles: ['user'] })).toThrow(
      TenantScopeViolationError,
    );
    expect(() => assertTenantCompanyId({ roles: ['user'] })).toThrow(
      'Compania utilizatorului nu este determinată',
    );
  });

  it('platform admin without company_id: requires valid dtoCompanyId', () => {
    expect(assertTenantCompanyId({ roles: ['admin'] }, 5)).toBe(5);
  });

  it('platform: throws when dtoCompanyId missing or invalid', () => {
    expect(() => assertTenantCompanyId({ roles: ['admin'] })).toThrow(
      'ID-ul companiei este obligatoriu',
    );
    expect(() => assertTenantCompanyId({ roles: ['admin'] }, 0)).toThrow(
      TenantScopeViolationError,
    );
    expect(() =>
      assertTenantCompanyId({ permissions: ['assignment.read_all'] }, null),
    ).toThrow(TenantScopeViolationError);
  });

  it('isSuperAdmin with company_id: platform path uses dto', () => {
    expect(
      assertTenantCompanyId(
        { isSuperAdmin: true, company_id: 16 },
        20,
      ),
    ).toBe(20);
  });

  it('tenant cannot escalate via dto even with assignment.read_all', () => {
    expect(() =>
      assertTenantCompanyId(
        {
          company_id: 16,
          permissions: ['assignment.read_all'],
          roles: ['admin'],
        },
        1,
      ),
    ).toThrow(TenantScopeViolationError);
  });
});

describe('isPlatformSubscriptionAdmin', () => {
  it('blocks tenant-bound user even with isSuperAdmin and hasPlatformWideAccess', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: 15,
        isSuperAdmin: true,
        hasPlatformWideAccess: true,
        permissions: ['assignment.read_all'],
        roles: ['admin'],
      }),
    ).toBe(false);
  });

  it.each([
    { label: 'company_id snake_case + admin', input: { company_id: 15, roles: ['admin'] } },
    { label: 'companyId camelCase + admin', input: { companyId: 15, roles: ['admin'] } },
    {
      label: 'company_id + assignment.read_all',
      input: { company_id: 15, permissions: ['assignment.read_all'] },
    },
    {
      label: 'companyId + assignment.read_all',
      input: { companyId: 15, permissions: ['assignment.read_all'] },
    },
  ])('tenant-scoped for subscription (not platform): $label', ({ input }) => {
    expect(isPlatformSubscriptionAdmin(input)).toBe(false);
  });

  it('allows platform user without companyId', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: null,
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });

  it('allows role admin without companyId', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: null,
        roles: ['admin'],
      }),
    ).toBe(true);
  });

  it('company_id > 0 blocks super-admin role (stricter than hasPlatformWideAccess)', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: 10,
        roles: ['super-admin'],
      }),
    ).toBe(false);
  });

  it('company_id snake_case blocks super-admin role', () => {
    expect(
      isPlatformSubscriptionAdmin({
        company_id: 10,
        roles: ['super-admin'],
      }),
    ).toBe(false);
  });
});

describe('hasPlatformWideAccess vs isPlatformSubscriptionAdmin (bound tenant)', () => {
  /**
   * Documented intentional split:
   * - suppliers-ms: isSuperAdmin / super-admin bypass company_id for catalog RBAC
   * - company-ms subscription.constants.test: companyId + isSuperAdmin => NOT subscription admin
   */
  const boundSuperAdmin = {
    isSuperAdmin: true,
    company_id: 15,
    roles: ['super-admin'] as string[],
  };

  it('hasPlatformWideAccess: isSuperAdmin/super-admin stay platform-wide with company_id', () => {
    expect(hasPlatformWideAccess(boundSuperAdmin)).toBe(true);
    expect(
      hasPlatformWideAccess({
        roles: ['super-admin'],
        company_id: 15,
      }),
    ).toBe(true);
  });

  it('isPlatformSubscriptionAdmin: bound company_id blocks even isSuperAdmin/super-admin', () => {
    expect(isPlatformSubscriptionAdmin(boundSuperAdmin)).toBe(false);
    expect(
      isPlatformSubscriptionAdmin({
        company_id: 15,
        roles: ['super-admin'],
      }),
    ).toBe(false);
  });

  it('unbound platform operator: both helpers agree', () => {
    const platform = { permissions: ['assignment.read_all'], roles: ['admin'] };
    expect(hasPlatformWideAccess(platform)).toBe(true);
    expect(isPlatformSubscriptionAdmin(platform)).toBe(true);
  });
});

describe('parity with suppliers-ms supplier-product-access.test.ts', () => {
  it('mirrors documented supplier access matrix', () => {
    expect(
      hasPlatformWideAccess({
        permissions: ['assignment.read_company', 'suppliers.read'],
      }),
    ).toBe(false);

    expect(
      isTenantScopedRequester({
        company_id: 1,
        company_type: 'client',
        permissions: ['assignment.read_company'],
      } as never),
    ).toBe(true);

    expect(
      hasPlatformWideAccess({ permissions: ['assignment.read_all'] }),
    ).toBe(true);

    expect(
      hasPlatformWideAccess({
        permissions: ['assignment.read_all'],
        company_id: 1,
      }),
    ).toBe(false);

    expect(hasPlatformWideAccess({ roles: ['admin'] })).toBe(true);

    expect(
      hasPlatformWideAccess({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(false);

    expect(
      isTenantScopedRequester({
        roles: ['admin'],
        company_id: 15,
      }),
    ).toBe(true);
  });
});
