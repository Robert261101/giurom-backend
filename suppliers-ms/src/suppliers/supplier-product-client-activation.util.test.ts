/**
 * Jest: npm test -- src/suppliers/supplier-product-client-activation.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import { resolveIsActiveForClientProduct } from './supplier-product-client-activation.util';

describe('resolveIsActiveForClientProduct', () => {
  it('global active + no row for current client + row exists for other client → ACTIV', () => {
    const result = resolveIsActiveForClientProduct(true, undefined);
    expect(result).toBe(true);
  });

  it('global active + per-client row false for current client → INACTIV', () => {
    expect(resolveIsActiveForClientProduct(true, { is_active: false })).toBe(
      false,
    );
    expect(resolveIsActiveForClientProduct(1, { is_active: 0 })).toBe(false);
  });

  it('global active + per-client row true for current client → ACTIV', () => {
    expect(resolveIsActiveForClientProduct(true, { is_active: true })).toBe(
      true,
    );
    expect(resolveIsActiveForClientProduct(1, { is_active: 1 })).toBe(true);
  });

  it('global inactive → indisponibil for all clients regardless of per-client row', () => {
    expect(resolveIsActiveForClientProduct(false, undefined)).toBe(false);
    expect(resolveIsActiveForClientProduct(0, { is_active: true })).toBe(false);
    expect(resolveIsActiveForClientProduct('0', { is_active: true })).toBe(
      false,
    );
  });
});
