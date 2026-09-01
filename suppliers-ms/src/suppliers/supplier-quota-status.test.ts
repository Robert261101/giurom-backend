/**
 * Jest: npx jest src/suppliers/supplier-quota-status.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  normalizeSupplierQuotaStatus,
  supplierQuotaStatusCountsTowardLimit,
  supplierQuotaStatusIsAccessible,
  isSupplierEligibleForNewOrder,
  TERMINAL_SUPPLIER_ORDER_STATUSES,
} from './supplier-quota-status';

describe('supplier-quota-status', () => {
  it('defaults unknown values to active', () => {
    expect(normalizeSupplierQuotaStatus(undefined)).toBe('active');
    expect(normalizeSupplierQuotaStatus('')).toBe('active');
  });

  it('active/inactive occupy quota; blocked/removed do not', () => {
    expect(supplierQuotaStatusCountsTowardLimit('active')).toBe(true);
    expect(supplierQuotaStatusCountsTowardLimit('blocked')).toBe(false);
    expect(supplierQuotaStatusCountsTowardLimit('removed')).toBe(false);
  });

  it('only active quota status is accessible', () => {
    expect(supplierQuotaStatusIsAccessible('active')).toBe(true);
    expect(supplierQuotaStatusIsAccessible('blocked')).toBe(false);
    expect(supplierQuotaStatusIsAccessible('removed')).toBe(false);
  });

  it('terminal order statuses are delivered and cancelled only', () => {
    expect(TERMINAL_SUPPLIER_ORDER_STATUSES.has('delivered')).toBe(true);
    expect(TERMINAL_SUPPLIER_ORDER_STATUSES.has('cancelled')).toBe(true);
    expect(TERMINAL_SUPPLIER_ORDER_STATUSES.has('sofer')).toBe(false);
    expect(TERMINAL_SUPPLIER_ORDER_STATUSES.has('draft')).toBe(false);
  });

  describe('isSupplierEligibleForNewOrder', () => {
    it('active quota (Cont) -> eligible', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: true,
          quota_status: 'active',
        }),
      ).toBe(true);
    });

    it('blocked quota (Cont) -> not eligible', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: true,
          quota_status: 'blocked',
        }),
      ).toBe(false);
    });

    it('removed quota (Cont) -> not eligible', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: true,
          quota_status: 'removed',
        }),
      ).toBe(false);
    });

    it('blocked manual quota -> not eligible', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: null,
          quota_status: 'blocked',
        }),
      ).toBe(false);
    });

    it('removed manual quota -> not eligible', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: null,
          quota_status: 'removed',
        }),
      ).toBe(false);
    });

    it('inactive Cont supplier master stays excluded independently of quota', () => {
      expect(
        isSupplierEligibleForNewOrder({
          has_supplier_account: true,
          is_active: false,
          quota_status: 'active',
        }),
      ).toBe(false);
    });

    it('manual supplier ignores global is_active when per-client association is active', () => {
      expect(
        isSupplierEligibleForNewOrder({
          has_supplier_account: false,
          is_active: false,
          client_association_is_active: true,
          quota_status: 'active',
        }),
      ).toBe(true);
    });

    it('client_association_is_active false stays excluded', () => {
      expect(
        isSupplierEligibleForNewOrder({
          is_active: true,
          client_association_is_active: false,
          quota_status: 'active',
        }),
      ).toBe(false);
    });
  });
});
