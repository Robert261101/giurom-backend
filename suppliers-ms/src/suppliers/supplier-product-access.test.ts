/**
 * Jest: npm test -- src/suppliers/supplier-product-access.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  isAllowedClientManagedProductCompany,
  hasPlatformWideSupplierAccess,
  isAdminOrSuperAdminFromPermissions,
  isTenantScopedSupplierRequester,
} from './supplier-product-access';

describe('supplier-product-access', () => {
  it('legacy null company_id is allowed for client-managed products', () => {
    expect(isAllowedClientManagedProductCompany(null, 10, null)).toBe(true);
    expect(isAllowedClientManagedProductCompany(undefined, 10, 99)).toBe(true);
    expect(isAllowedClientManagedProductCompany(0, 10, null)).toBe(true);
  });

  it('same-tenant product tag is allowed', () => {
    expect(isAllowedClientManagedProductCompany(10, 10, null)).toBe(true);
    expect(isAllowedClientManagedProductCompany(77, 10, 77)).toBe(true);
  });

  it('cross-tenant product tag is rejected', () => {
    expect(isAllowedClientManagedProductCompany(5, 10, 77)).toBe(false);
    expect(isAllowedClientManagedProductCompany(5, 10, null)).toBe(false);
  });

  it('assignment.read_company is NOT platform-wide supplier access', () => {
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_company', 'suppliers.read'],
      }),
    ).toBe(false);
    expect(
      isAdminOrSuperAdminFromPermissions(['assignment.read_company']),
    ).toBe(true);
  });

  it('assignment.read_company alone remains tenant-scoped for catalog', () => {
    expect(
      isTenantScopedSupplierRequester({
        company_id: 15,
        permissions: ['assignment.read_company', 'suppliers.create'],
      }),
    ).toBe(true);
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_company', 'suppliers.create'],
      }),
    ).toBe(false);
  });

  it('tenant-scoped requires company_id and non-platform', () => {
    expect(
      isTenantScopedSupplierRequester({
        company_id: 1,
        company_type: 'client',
        permissions: ['assignment.read_company'],
      }),
    ).toBe(true);
    expect(
      isTenantScopedSupplierRequester({
        company_id: null,
        permissions: [],
      }),
    ).toBe(false);
    expect(
      isTenantScopedSupplierRequester({
        company_id: 1,
        permissions: ['assignment.read_all'],
        roles: ['admin'],
      }),
    ).toBe(true);
  });

  it('assignment.read_all without company_id IS platform-wide', () => {
    expect(
      hasPlatformWideSupplierAccess({ permissions: ['assignment.read_all'] }),
    ).toBe(true);
  });

  it('assignment.read_all WITH company_id is NOT platform-wide', () => {
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_all'],
        company_id: 1,
      }),
    ).toBe(false);
  });

  it('role admin WITHOUT company_id remains platform bypass', () => {
    expect(hasPlatformWideSupplierAccess({ roles: ['admin'] })).toBe(true);
  });

  it('role admin WITH company_id is tenant-scoped (no Manual leak)', () => {
    expect(
      hasPlatformWideSupplierAccess({
        roles: ['admin'],
        company_id: 15,
        company_type: 'client',
      }),
    ).toBe(false);
    expect(
      isTenantScopedSupplierRequester({
        roles: ['admin'],
        company_id: 15,
        company_type: 'client',
      }),
    ).toBe(true);
  });

  it('admin@giurom.ro shape: company_id + admin + assignment.read_all stays tenant-scoped', () => {
    expect(
      hasPlatformWideSupplierAccess({
        roles: ['admin'],
        company_id: 1,
        company_type: 'client',
        permissions: ['assignment.read_all', 'assignment.read_company'],
      }),
    ).toBe(false);
    expect(
      isTenantScopedSupplierRequester({
        roles: ['admin'],
        company_id: 1,
        company_type: 'client',
        permissions: ['assignment.read_all', 'assignment.read_company'],
      }),
    ).toBe(true);
  });

  it('isSuperAdmin still platform-wide even with company_id', () => {
    expect(
      hasPlatformWideSupplierAccess({
        isSuperAdmin: true,
        company_id: 1,
        company_type: 'client',
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });

  it('role super-admin is platform-wide even with company_id', () => {
    expect(
      hasPlatformWideSupplierAccess({
        roles: ['super-admin'],
        company_id: 1,
        company_type: 'client',
      }),
    ).toBe(true);
  });
});
