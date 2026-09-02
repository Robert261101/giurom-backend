/**
 * Jest: npm test -- src/suppliers/connection-code.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  SUPPLIER_CONNECTION_CODE_ALPHABET,
  SUPPLIER_CONNECTION_CODE_LENGTH,
  generateSupplierConnectionCode,
  isValidSupplierConnectionCodeFormat,
  normalizeSupplierConnectionCode,
} from './connection-code.util';

describe('connection-code.util', () => {
  it('normalizes whitespace, case and separators', () => {
    expect(normalizeSupplierConnectionCode(' ab-3k_9m.2q ')).toBe('AB3K9M2Q');
    expect(normalizeSupplierConnectionCode('')).toBeNull();
    expect(normalizeSupplierConnectionCode(null)).toBeNull();
  });

  it('generates Crockford-like codes of fixed length without confusing chars', () => {
    const code = generateSupplierConnectionCode(() =>
      Uint8Array.from({ length: 32 }, () => 2),
    );
    expect(code).toHaveLength(SUPPLIER_CONNECTION_CODE_LENGTH);
    expect(isValidSupplierConnectionCodeFormat(code)).toBe(true);
    expect(code.includes('0')).toBe(false);
    expect(code.includes('1')).toBe(false);
    expect(code.includes('I')).toBe(false);
    expect(code.includes('O')).toBe(false);
  });

  it('uses only alphabet characters', () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateSupplierConnectionCode();
      for (const ch of code) {
        expect(SUPPLIER_CONNECTION_CODE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  it('produces unique codes across many draws (probabilistic)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      set.add(generateSupplierConnectionCode());
    }
    expect(set.size).toBe(200);
  });
});
