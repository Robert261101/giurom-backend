import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import {
  assertTenantLocationIdRequired,
  isGlobalStockAdmin,
  isTenantStockRequester,
  parseStockLocationId,
} from './stock-access';

describe('stock tenant location scope', () => {
  const clientA = { company_id: 10, permissions: ['stock.read'] };
  const clientB = { company_id: 20, permissions: ['stock.read'] };
  const tenantAdminA = { roles: ['admin'], company_id: 10 };
  const tenantAssignmentA = {
    permissions: ['assignment.read_all'],
    company_id: 10,
  };
  const platform = { permissions: ['assignment.read_all'] };

  it('tenant requester requires location_id', () => {
    expect(() => assertTenantLocationIdRequired(clientA, undefined)).toThrow(
      BadRequestException,
    );
    expect(() => assertTenantLocationIdRequired(clientA, null)).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertTenantLocationIdRequired(clientA, 5),
    ).not.toThrow();
  });

  it('platform operator does not require location_id at helper level', () => {
    expect(() =>
      assertTenantLocationIdRequired(platform, undefined),
    ).not.toThrow();
  });

  it('admin + company_id is tenant, not platform', () => {
    expect(isTenantStockRequester(tenantAdminA)).toBe(true);
    expect(isGlobalStockAdmin(tenantAdminA)).toBe(false);
  });

  it('assignment.read_all + company_id is tenant', () => {
    expect(isTenantStockRequester(tenantAssignmentA)).toBe(true);
    expect(isGlobalStockAdmin(tenantAssignmentA)).toBe(false);
  });

  it('parseStockLocationId rejects invalid values', () => {
    expect(parseStockLocationId('12')).toBe(12);
    expect(parseStockLocationId(0)).toBeUndefined();
    expect(parseStockLocationId('')).toBeUndefined();
  });

  describe('read isolation simulation', () => {
    type StockRow = { product_id: number; location_id: number; quantity: number };

    const rows: StockRow[] = [
      { product_id: 100, location_id: 1, quantity: 5 },
      { product_id: 100, location_id: 2, quantity: 9 },
    ];

    function filterStockForTenant(
      allRows: StockRow[],
      locationId: number | undefined,
      user: typeof clientA | typeof platform,
    ) {
      if (!isTenantStockRequester(user)) {
        return allRows;
      }
      assertTenantLocationIdRequired(user, locationId);
      return allRows.filter((r) => r.location_id === locationId);
    }

    it('client A at location A sees only A stock', () => {
      const result = filterStockForTenant(rows, 1, clientA);
      expect(result).toEqual([{ product_id: 100, location_id: 1, quantity: 5 }]);
    });

    it('client A without location is denied', () => {
      expect(() => filterStockForTenant(rows, undefined, clientA)).toThrow(
        BadRequestException,
      );
    });

    it('platform sees all locations', () => {
      expect(filterStockForTenant(rows, undefined, platform)).toHaveLength(2);
    });

    it('client B at location B sees B qty only', () => {
      const result = filterStockForTenant(rows, 2, clientB);
      expect(result[0]?.quantity).toBe(9);
    });
  });

  describe('consume isolation simulation', () => {
    it('consume at A does not reduce B', () => {
      const stock = new Map<string, number>([
        ['100:1', 5],
        ['100:2', 9],
      ]);
      const consume = (productId: number, locationId: number, qty: number) => {
        const key = `${productId}:${locationId}`;
        stock.set(key, (stock.get(key) ?? 0) - qty);
      };
      consume(100, 1, 2);
      expect(stock.get('100:1')).toBe(3);
      expect(stock.get('100:2')).toBe(9);
    });
  });

  describe('transaction list isolation simulation', () => {
    type TxRow = { id: number; product_id: number; location_id: number };

    const txs: TxRow[] = [
      { id: 1, product_id: 100, location_id: 1 },
      { id: 2, product_id: 100, location_id: 2 },
    ];

    function filterTxForTenant(
      all: TxRow[],
      locationId: number | undefined,
      user:
        | typeof clientA
        | typeof tenantAdminA
        | typeof platform,
    ) {
      if (!isTenantStockRequester(user)) {
        return all;
      }
      assertTenantLocationIdRequired(user, locationId);
      return all.filter((tx) => tx.location_id === locationId);
    }

    it('client A at location A sees only A transactions', () => {
      expect(filterTxForTenant(txs, 1, clientA)).toEqual([
        { id: 1, product_id: 100, location_id: 1 },
      ]);
    });

    it('client A without location is denied', () => {
      expect(() => filterTxForTenant(txs, undefined, clientA)).toThrow(
        BadRequestException,
      );
    });

    it('tenant admin A at location B gets B rows only (company check async elsewhere)', () => {
      expect(filterTxForTenant(txs, 2, tenantAdminA)).toEqual([
        { id: 2, product_id: 100, location_id: 2 },
      ]);
    });

    it('platform sees all transactions', () => {
      expect(filterTxForTenant(txs, undefined, platform)).toHaveLength(2);
    });
  });

  describe('availability isolation simulation', () => {
    it('availability at location A ignores B qty', () => {
      const rows = [
        { product_id: 100, location_id: 1, quantity: 4 },
        { product_id: 100, location_id: 2, quantity: 100 },
      ];
      const availableAt = (productId: number, locationId: number) =>
        rows
          .filter(
            (r) => r.product_id === productId && r.location_id === locationId,
          )
          .reduce((sum, r) => sum + r.quantity, 0);
      expect(availableAt(100, 1)).toBe(4);
      expect(availableAt(100, 2)).toBe(100);
    });
  });
});
