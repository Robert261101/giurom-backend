/**
 * Jest: npx jest src/suppliers/client-supplier-relationship.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertClientSupplierRelationshipResolved,
  ClientSupplierRelationshipError,
  isAccountLinkOperationallyActive,
  isManualAssociationOperationallyActive,
} from './client-supplier-relationship.util';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';

describe('client-supplier-relationship.util', () => {
  describe('account link operational active', () => {
    it('active link with active quota is operational', () => {
      expect(
        isAccountLinkOperationallyActive({
          client_company_id: 1,
          supplier_id: 10,
          is_active: true,
          quota_status: 'active',
        }),
      ).toBe(true);
    });

    it('inactive link is not operational even with active quota', () => {
      expect(
        isAccountLinkOperationallyActive({
          client_company_id: 1,
          supplier_id: 10,
          is_active: false,
          quota_status: 'active',
        }),
      ).toBe(false);
    });
  });

  describe('manual association operational active', () => {
    it('defaults to active when no state row', () => {
      expect(isManualAssociationOperationallyActive(null)).toBe(true);
    });

    it('per-client inactive does not require global supplier is_active', () => {
      expect(
        isManualAssociationOperationallyActive({
          client_company_id: 1,
          supplier_id: 10,
          is_active: false,
          quota_status: 'active',
        }),
      ).toBe(false);
    });
  });

  describe('assertClientSupplierRelationshipResolved', () => {
    it('account: removed link denies', () => {
      expect(() =>
        assertClientSupplierRelationshipResolved(
          1,
          10,
          {
            mode: 'account',
            hasLocationAssociation: false,
            link: {
              client_company_id: 1,
              supplier_id: 10,
              is_active: true,
              quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
            },
          },
          { requireOperationalActive: true },
        ),
      ).toThrow(ClientSupplierRelationshipError);
    });

    it('account: client A inactive does not affect validation for same supplier id on client B snapshot', () => {
      const snapshotA = {
        mode: 'account' as const,
        hasLocationAssociation: false,
        link: {
          client_company_id: 1,
          supplier_id: 10,
          is_active: false,
          quota_status: 'active',
        },
      };
      const snapshotB = {
        mode: 'account' as const,
        hasLocationAssociation: false,
        link: {
          client_company_id: 2,
          supplier_id: 10,
          is_active: true,
          quota_status: 'active',
        },
      };

      expect(() =>
        assertClientSupplierRelationshipResolved(1, 10, snapshotA, {
          requireOperationalActive: true,
        }),
      ).toThrow(ClientSupplierRelationshipError);

      expect(() =>
        assertClientSupplierRelationshipResolved(2, 10, snapshotB, {
          requireOperationalActive: true,
        }),
      ).not.toThrow();
    });

    it('manual: requires location association', () => {
      expect(() =>
        assertClientSupplierRelationshipResolved(
          1,
          10,
          {
            mode: 'manual',
            hasLocationAssociation: false,
            manualState: null,
          },
          { requireOperationalActive: true },
        ),
      ).toThrow(ClientSupplierRelationshipError);
    });
  });
});
