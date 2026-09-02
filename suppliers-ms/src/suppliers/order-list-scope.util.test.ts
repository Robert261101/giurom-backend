import { describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { isPlatformOrderRequester } from './order-access';
import {
  applyOrderListTenantScopeToQueryBuilder,
  assertOrderListCompanyIdNotEscalated,
  resolveOrderListTenantCompanyId,
} from './order-list-scope.util';
import { SupplierOrder } from './entities/supplier-order.entity';

type OrderRow = {
  id: number;
  supplier_id: number;
  company_id: number;
};

/** Mirrors batch SQL tenant filter for cross-client regression tests. */
function filterOrdersForRequester(
  rows: OrderRow[],
  requester: Parameters<typeof resolveOrderListTenantCompanyId>[0],
  supplierIds: number[],
): OrderRow[] {
  const supplierSet = new Set(supplierIds);
  let out = rows.filter((row) => supplierSet.has(row.supplier_id));

  if (!requester || isPlatformOrderRequester(requester)) {
    return out;
  }

  const tenantCompanyId = resolveOrderListTenantCompanyId(requester);
  if (tenantCompanyId == null) {
    return [];
  }
  return out.filter((row) => row.company_id === tenantCompanyId);
}

describe('order-list-scope.util', () => {
  const clientA = { company_id: 10, permissions: ['order.read'] };
  const clientB = { company_id: 20, permissions: ['order.read'] };
  const platform = { permissions: ['assignment.read_all'] };
  const tenantAdminA = { roles: ['admin'], company_id: 10 };
  const tenantAssignmentReadAllA = {
    permissions: ['assignment.read_all'],
    company_id: 10,
  };

  const sharedSupplierId = 1;
  const rows: OrderRow[] = [
    { id: 101, supplier_id: sharedSupplierId, company_id: 10 },
    { id: 102, supplier_id: sharedSupplierId, company_id: 20 },
  ];

  describe('resolveOrderListTenantCompanyId', () => {
    it('returns JWT company for tenant requester', () => {
      expect(resolveOrderListTenantCompanyId(clientA)).toBe(10);
      expect(resolveOrderListTenantCompanyId({ companyId: 15 })).toBe(15);
    });

    it('returns null for platform operator without company', () => {
      expect(resolveOrderListTenantCompanyId(platform)).toBeNull();
      expect(resolveOrderListTenantCompanyId({ roles: ['admin'] })).toBeNull();
    });

    it('tenant admin with company_id stays tenant-scoped', () => {
      expect(resolveOrderListTenantCompanyId(tenantAdminA)).toBe(10);
    });

    it('assignment.read_all with company_id stays tenant-scoped', () => {
      expect(resolveOrderListTenantCompanyId(tenantAssignmentReadAllA)).toBe(10);
    });
  });

  describe('assertOrderListCompanyIdNotEscalated', () => {
    it('rejects tenant trying to request another company_id', () => {
      expect(() =>
        assertOrderListCompanyIdNotEscalated(clientA, 20),
      ).toThrow(ForbiddenException);
    });

    it('allows matching company_id for tenant', () => {
      expect(() =>
        assertOrderListCompanyIdNotEscalated(clientA, 10),
      ).not.toThrow();
    });

    it('platform may request any company_id (no tenant binding)', () => {
      expect(() =>
        assertOrderListCompanyIdNotEscalated(platform, 20),
      ).not.toThrow();
    });
  });

  describe('applyOrderListTenantScopeToQueryBuilder', () => {
    function createMockQb() {
      const andWhere = jest.fn().mockReturnThis();
      const qb = { andWhere } as unknown as SelectQueryBuilder<SupplierOrder>;
      return { qb, andWhere };
    }

    it('adds company_id filter for tenant requester', () => {
      const { qb, andWhere } = createMockQb();
      applyOrderListTenantScopeToQueryBuilder(qb, clientA);
      expect(andWhere).toHaveBeenCalledWith(
        'order.company_id = :tenantCompanyId',
        { tenantCompanyId: 10 },
      );
    });

    it('does not add tenant filter for platform requester', () => {
      const { qb, andWhere } = createMockQb();
      applyOrderListTenantScopeToQueryBuilder(qb, platform);
      expect(andWhere).not.toHaveBeenCalled();
    });

    it('blocks non-platform requester without company_id', () => {
      const { qb, andWhere } = createMockQb();
      applyOrderListTenantScopeToQueryBuilder(qb, {
        permissions: ['order.read'],
      });
      expect(andWhere).toHaveBeenCalledWith('1 = 0');
    });
  });

  describe('cross-client batch isolation', () => {
    it('requester A sees only company A orders for shared supplier', () => {
      const result = filterOrdersForRequester(rows, clientA, [sharedSupplierId]);
      expect(result.map((r) => r.id)).toEqual([101]);
    });

    it('requester B sees only company B orders for shared supplier', () => {
      const result = filterOrdersForRequester(rows, clientB, [sharedSupplierId]);
      expect(result.map((r) => r.id)).toEqual([102]);
    });

    it('arbitrary supplier_ids cannot leak other tenant orders', () => {
      const result = filterOrdersForRequester(rows, clientA, [sharedSupplierId]);
      expect(result.some((r) => r.company_id === 20)).toBe(false);
    });

    it('platform requester without company_id keeps cross-tenant visibility', () => {
      const result = filterOrdersForRequester(rows, platform, [sharedSupplierId]);
      expect(result.map((r) => r.id).sort()).toEqual([101, 102]);
    });

    it('tenant admin with company_id=A sees only A', () => {
      const result = filterOrdersForRequester(rows, tenantAdminA, [
        sharedSupplierId,
      ]);
      expect(result.map((r) => r.id)).toEqual([101]);
    });

    it('assignment.read_all tenant with company_id=A sees only A', () => {
      const result = filterOrdersForRequester(
        rows,
        tenantAssignmentReadAllA,
        [sharedSupplierId],
      );
      expect(result.map((r) => r.id)).toEqual([101]);
    });
  });
});
