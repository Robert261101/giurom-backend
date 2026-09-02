/**
 * Jest: npm test -- src/suppliers/client-stock-product-resolution.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertOrderItemProductIdMatchesMapping,
  assertProductExistsInLocationNomenclator,
  assertRequestedClientStockProductId,
  ClientStockProductResolutionError,
  resolveClientStockProductIdFromMapping,
} from './client-stock-product-resolution.util';

describe('resolveClientStockProductIdFromMapping', () => {
  const mappingLoc10 = {
    client_company_id: 10,
    client_location_id: 10,
    supplier_product_id: 501,
    client_stock_product_id: 100,
  };

  const mappingLoc11 = {
    client_company_id: 10,
    client_location_id: 11,
    supplier_product_id: 501,
    client_stock_product_id: 200,
  };

  it('returns client_stock_product_id for exact client + location + supplier product', () => {
    expect(resolveClientStockProductIdFromMapping(mappingLoc10, 10, 501, 10)).toBe(
      100,
    );
    expect(resolveClientStockProductIdFromMapping(mappingLoc11, 10, 501, 11)).toBe(
      200,
    );
  });

  it('fails when mapping is missing', () => {
    expect(() => resolveClientStockProductIdFromMapping(null, 10, 501, 10)).toThrow(
      ClientStockProductResolutionError,
    );
  });

  it('fails when mapping belongs to another client', () => {
    expect(() =>
      resolveClientStockProductIdFromMapping(mappingLoc10, 20, 501, 10),
    ).toThrow(ClientStockProductResolutionError);
  });

  it('fails cross-location: mapping at 10 cannot serve order at 11', () => {
    expect(() =>
      resolveClientStockProductIdFromMapping(mappingLoc10, 10, 501, 11),
    ).toThrow(ClientStockProductResolutionError);
    try {
      resolveClientStockProductIdFromMapping(mappingLoc10, 10, 501, 11);
    } catch (error) {
      expect((error as ClientStockProductResolutionError).code).toBe(
        'MISSING_MAPPING',
      );
    }
  });

  it('fails when location_id is missing', () => {
    expect(() =>
      resolveClientStockProductIdFromMapping(mappingLoc10, 10, 501, 0),
    ).toThrow(ClientStockProductResolutionError);
  });
});

describe('assertRequestedClientStockProductId', () => {
  it('accepts matching frontend product_id', () => {
    expect(() => assertRequestedClientStockProductId(100, 100)).not.toThrow();
  });

  it('rejects arbitrary frontend product_id', () => {
    expect(() => assertRequestedClientStockProductId(100, 999)).toThrow(
      ClientStockProductResolutionError,
    );
  });
});

describe('assertOrderItemProductIdMatchesMapping', () => {
  it('accepts consistent order item product_id', () => {
    expect(() => assertOrderItemProductIdMatchesMapping(100, 100)).not.toThrow();
  });

  it('rejects inconsistent order item product_id', () => {
    expect(() => assertOrderItemProductIdMatchesMapping(200, 100)).toThrow(
      ClientStockProductResolutionError,
    );
  });
});

describe('assertProductExistsInLocationNomenclator', () => {
  it('accepts product present at order location', () => {
    expect(() =>
      assertProductExistsInLocationNomenclator(100, 7, [99, 100, 101]),
    ).not.toThrow();
  });

  it('fails when product exists only at another location catalog', () => {
    expect(() =>
      assertProductExistsInLocationNomenclator(100, 8, [200, 201]),
    ).toThrow(ClientStockProductResolutionError);
  });
});

describe('client and location isolation', () => {
  it('same client, two locations map same supplier product differently', () => {
    const mapping10 = {
      client_company_id: 1,
      client_location_id: 10,
      supplier_product_id: 900,
      client_stock_product_id: 100,
    };
    const mapping11 = {
      client_company_id: 1,
      client_location_id: 11,
      supplier_product_id: 900,
      client_stock_product_id: 200,
    };

    expect(resolveClientStockProductIdFromMapping(mapping10, 1, 900, 10)).toBe(
      100,
    );
    expect(resolveClientStockProductIdFromMapping(mapping11, 1, 900, 11)).toBe(
      200,
    );
    expect(() =>
      resolveClientStockProductIdFromMapping(mapping10, 1, 900, 11),
    ).toThrow();
  });

  it('client A and B at same location id use separate mappings', () => {
    const mappingA = {
      client_company_id: 1,
      client_location_id: 10,
      supplier_product_id: 900,
      client_stock_product_id: 100,
    };
    const mappingB = {
      client_company_id: 2,
      client_location_id: 10,
      supplier_product_id: 900,
      client_stock_product_id: 300,
    };

    expect(resolveClientStockProductIdFromMapping(mappingA, 1, 900, 10)).toBe(100);
    expect(resolveClientStockProductIdFromMapping(mappingB, 2, 900, 10)).toBe(300);
    expect(() => resolveClientStockProductIdFromMapping(mappingA, 2, 900, 10)).toThrow();
  });
});
