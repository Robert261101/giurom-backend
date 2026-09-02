import { describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import {
  assertOrderCompanyAccess,
  assertOrderCompanyIdNotEscalated,
  filterOrdersByRequesterCompany,
  isPlatformOrderRequester,
  orderBelongsToTenant,
  resolveOrderTenantCompanyId,
} from './order-access';

describe('order-access tenant isolation', () => {
  const clientA = { company_id: 10, permissions: ['order.read'] };
  const clientB = { company_id: 20, permissions: ['order.read'] };
  const platform = { permissions: ['assignment.read_all'] };
  const tenantAdminA = { roles: ['admin'], company_id: 10 };
  const tenantAssignmentReadAllA = {
    permissions: ['assignment.read_all'],
    company_id: 10,
  };

  const orderA = { company_id: 10 };
  const orderB = { company_id: 20 };

  describe('resolveOrderTenantCompanyId', () => {
    it('returns JWT company for tenant requester', () => {
      expect(resolveOrderTenantCompanyId(clientA)).toBe(10);
    });

    it('returns null for platform operator without company', () => {
      expect(resolveOrderTenantCompanyId(platform)).toBeNull();
    });

    it('tenant admin with company_id stays tenant-scoped', () => {
      expect(resolveOrderTenantCompanyId(tenantAdminA)).toBe(10);
      expect(isPlatformOrderRequester(tenantAdminA)).toBe(false);
    });

    it('assignment.read_all with company_id stays tenant-scoped', () => {
      expect(resolveOrderTenantCompanyId(tenantAssignmentReadAllA)).toBe(10);
      expect(isPlatformOrderRequester(tenantAssignmentReadAllA)).toBe(false);
    });
  });

  describe('assertOrderCompanyAccess (order by ID)', () => {
    it('tenant A can access order A', () => {
      expect(() => assertOrderCompanyAccess(orderA, clientA)).not.toThrow();
    });

    it('tenant A cannot access order B', () => {
      expect(() => assertOrderCompanyAccess(orderB, clientA)).toThrow(
        ForbiddenException,
      );
    });

    it('admin + company_id=A cannot access order B', () => {
      expect(() => assertOrderCompanyAccess(orderB, tenantAdminA)).toThrow(
        ForbiddenException,
      );
    });

    it('assignment.read_all + company_id=A cannot access order B', () => {
      expect(() =>
        assertOrderCompanyAccess(orderB, tenantAssignmentReadAllA),
      ).toThrow(ForbiddenException);
    });

    it('platform without company can access any order', () => {
      expect(() => assertOrderCompanyAccess(orderA, platform)).not.toThrow();
      expect(() => assertOrderCompanyAccess(orderB, platform)).not.toThrow();
    });
  });

  describe('filterOrdersByRequesterCompany (mixed IDs)', () => {
    const rows = [
      { id: 1, company_id: 10 },
      { id: 2, company_id: 10 },
      { id: 3, company_id: 20 },
    ];

    it('tenant A gets only A orders from mixed list', () => {
      const result = filterOrdersByRequesterCompany(rows, clientA);
      expect(result.map((r) => r.id)).toEqual([1, 2]);
    });

    it('tenant B gets only B orders from mixed list', () => {
      const result = filterOrdersByRequesterCompany(rows, clientB);
      expect(result.map((r) => r.id)).toEqual([3]);
    });

    it('platform keeps all orders', () => {
      expect(filterOrdersByRequesterCompany(rows, platform)).toHaveLength(3);
    });

    it('admin + company_id=A filters like tenant', () => {
      expect(
        filterOrdersByRequesterCompany(rows, tenantAdminA).map((r) => r.id),
      ).toEqual([1, 2]);
    });
  });

  describe('assertOrderCompanyIdNotEscalated (createOrder)', () => {
    it('tenant admin A cannot set company_id=B in body', () => {
      expect(() =>
        assertOrderCompanyIdNotEscalated(tenantAdminA, 20),
      ).toThrow(ForbiddenException);
    });

    it('assignment.read_all tenant A cannot set company_id=B', () => {
      expect(() =>
        assertOrderCompanyIdNotEscalated(tenantAssignmentReadAllA, 20),
      ).toThrow(ForbiddenException);
    });

    it('platform may pass any company_id', () => {
      expect(() =>
        assertOrderCompanyIdNotEscalated(platform, 20),
      ).not.toThrow();
    });
  });

  describe('reception report row isolation', () => {
    type ReceptionRow = { supplier_order_id: number; company_id: number };

    const receptionRows: ReceptionRow[] = [
      { supplier_order_id: 101, company_id: 10 },
      { supplier_order_id: 102, company_id: 20 },
    ];

    function filterReceptionRowsForRequester(
      rows: ReceptionRow[],
      requester: Parameters<typeof orderBelongsToTenant>[1],
    ) {
      return rows.filter((row) =>
        orderBelongsToTenant({ company_id: row.company_id }, requester),
      );
    }

    it('client A with shared supplier sees only A receptions', () => {
      const result = filterReceptionRowsForRequester(receptionRows, clientA);
      expect(result.map((r) => r.supplier_order_id)).toEqual([101]);
    });

    it('client B sees only B receptions', () => {
      const result = filterReceptionRowsForRequester(receptionRows, clientB);
      expect(result.map((r) => r.supplier_order_id)).toEqual([102]);
    });

    it('platform sees both', () => {
      expect(filterReceptionRowsForRequester(receptionRows, platform)).toHaveLength(
        2,
      );
    });
  });
});
