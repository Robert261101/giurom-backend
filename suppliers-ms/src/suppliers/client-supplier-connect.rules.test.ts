/**
 * Jest: npm test -- src/suppliers/client-supplier-connect.rules.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  decideConnectAttempt,
  isSupplierAccessibleViaLocationOrLink,
} from './client-supplier-connect.rules';
import { hasPlatformWideSupplierAccess } from './supplier-product-access';

describe('decideConnectAttempt', () => {
  const baseSupplier = {
    id: 10,
    owner_company_id: 99,
    is_active: true,
  };

  it('accepts a valid client connect', () => {
    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: baseSupplier,
        alreadyLinked: false,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects furnizor tenant connect with 403 reason', () => {
    expect(
      decideConnectAttempt({
        companyType: 'furnizor',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: baseSupplier,
        alreadyLinked: false,
      }),
    ).toEqual({ ok: false, reason: 'forbidden_furnizor' });
  });

  it('rejects invalid / missing / manual / inactive as invalid_code', () => {
    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: null,
        supplier: baseSupplier,
        alreadyLinked: false,
      }).ok,
    ).toBe(false);

    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: null,
        alreadyLinked: false,
      }),
    ).toEqual({ ok: false, reason: 'invalid_code' });

    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: { ...baseSupplier, owner_company_id: null },
        alreadyLinked: false,
      }),
    ).toEqual({ ok: false, reason: 'invalid_code' });

    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: { ...baseSupplier, is_active: false },
        alreadyLinked: false,
      }),
    ).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('rejects self-link', () => {
    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 99,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: baseSupplier,
        alreadyLinked: false,
      }),
    ).toEqual({ ok: false, reason: 'self_link' });
  });

  it('rejects already linked', () => {
    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: baseSupplier,
        alreadyLinked: true,
      }),
    ).toEqual({ ok: false, reason: 'already_linked' });
  });

  it('allows company_id client context even when role would be platform-wide', () => {
    expect(
      decideConnectAttempt({
        companyType: 'client',
        clientCompanyId: 5,
        normalizedCode: 'ABCDEFGHJKLM',
        supplier: baseSupplier,
        alreadyLinked: false,
      }),
    ).toEqual({ ok: true });
  });
});

describe('isSupplierAccessibleViaLocationOrLink', () => {
  it('allows company link with zero locations', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: true,
        supplierLocationIds: [],
        employeeLocationIds: [],
      }),
    ).toBe(true);
  });

  it('allows Manual location intersection without link', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: false,
        supplierLocationIds: [1, 2],
        employeeLocationIds: [2, 9],
        ownerCompanyId: null,
        requesterCompanyId: 5,
      }),
    ).toBe(true);
  });

  it('denies Cont with location intersection but no company link', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: false,
        supplierLocationIds: [1, 2],
        employeeLocationIds: [2, 9],
        ownerCompanyId: 99,
        requesterCompanyId: 5,
      }),
    ).toBe(false);
  });

  it('allows Cont only via client_supplier_links', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: true,
        supplierLocationIds: [],
        employeeLocationIds: [],
        ownerCompanyId: 99,
        requesterCompanyId: 5,
      }),
    ).toBe(true);
  });

  it('allows furnizor tenant to access own Cont by owner_company_id', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: false,
        supplierLocationIds: [],
        employeeLocationIds: [],
        ownerCompanyId: 77,
        requesterCompanyId: 77,
      }),
    ).toBe(true);
  });

  it('denies when neither link nor location match (Manual-style)', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: false,
        linkedByCompany: false,
        supplierLocationIds: [1],
        employeeLocationIds: [99],
        ownerCompanyId: null,
        requesterCompanyId: 5,
      }),
    ).toBe(false);
  });

  it('platform-wide still bypasses', () => {
    expect(
      isSupplierAccessibleViaLocationOrLink({
        hasPlatformWideAccess: true,
        linkedByCompany: false,
        supplierLocationIds: [],
        employeeLocationIds: [],
        ownerCompanyId: 99,
        requesterCompanyId: 5,
      }),
    ).toBe(true);
  });

  it('assignment.read_company is still NOT platform-wide', () => {
    expect(
      hasPlatformWideSupplierAccess({
        permissions: ['assignment.read_company'],
      }),
    ).toBe(false);
  });
});
