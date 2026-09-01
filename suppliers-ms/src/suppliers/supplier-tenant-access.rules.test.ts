/**
 * Pure unit tests for tenant supplier visibility SQL predicates (Manual vs Cont).
 * Jest: npm test -- src/suppliers/supplier-tenant-access.rules.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  isAccountOwnedSupplier,
  isSupplierAccessibleViaLocationOrLink,
} from './client-supplier-connect.rules';
import {
  hasPlatformWideSupplierAccess,
  isTenantScopedSupplierRequester,
} from './supplier-product-access';

describe('supplier tenant access rules', () => {
  it('classifies Cont vs Manual by owner_company_id', () => {
    expect(isAccountOwnedSupplier(null)).toBe(false);
    expect(isAccountOwnedSupplier(0)).toBe(false);
    expect(isAccountOwnedSupplier(12)).toBe(true);
  });

  it('client A Manual visible to A, not B', () => {
    const manual = {
      hasPlatformWideAccess: false,
      linkedByCompany: false,
      supplierLocationIds: [101],
      employeeLocationIds: [101, 102],
      ownerCompanyId: null as number | null,
      requesterCompanyId: 1,
    };
    expect(isSupplierAccessibleViaLocationOrLink(manual)).toBe(true);
    expect(
      isSupplierAccessibleViaLocationOrLink({
        ...manual,
        employeeLocationIds: [201],
        requesterCompanyId: 2,
      }),
    ).toBe(false);
  });

  it('Cont Y linked only to A: A yes, B no; after B link yes', () => {
    const base = {
      hasPlatformWideAccess: false,
      supplierLocationIds: [101],
      employeeLocationIds: [101],
      ownerCompanyId: 99,
    };
    expect(
      isSupplierAccessibleViaLocationOrLink({
        ...base,
        linkedByCompany: true,
        requesterCompanyId: 1,
      }),
    ).toBe(true);
    expect(
      isSupplierAccessibleViaLocationOrLink({
        ...base,
        linkedByCompany: false,
        requesterCompanyId: 2,
      }),
    ).toBe(false);
    expect(
      isSupplierAccessibleViaLocationOrLink({
        ...base,
        linkedByCompany: true,
        requesterCompanyId: 2,
      }),
    ).toBe(true);
  });

  it('inactive is filtered at list layer (access helper ignores is_active)', () => {
    // Access helper only answers "associated?"; is_active is applied by findForOrders/findCatalog.
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: true,
        supplierLocationIds: [],
        employeeLocationIds: [],
        ownerCompanyId: 99,
        requesterCompanyId: 1,
      }),
    ).toBe(true);
  });

  it('platform admin with assignment.read_all stays global only without company_id', () => {
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
    expect(
      isTenantScopedSupplierRequester({
        permissions: ['assignment.read_all'],
      }),
    ).toBe(false);
  });

  it('client JWT with assignment.read_all is NOT platform (admin@giurom.ro)', () => {
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_all'],
        roles: ['admin'],
        company_id: 1,
        company_type: 'client',
      }),
    ).toBe(false);
    expect(
      isTenantScopedSupplierRequester({
        permissions: ['assignment.read_all'],
        roles: ['admin'],
        company_id: 1,
        company_type: 'client',
      }),
    ).toBe(true);
  });
});
