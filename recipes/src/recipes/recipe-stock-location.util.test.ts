/**
 * Jest: npm test -- src/recipes/recipe-stock-location.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { resolveRecipeStockLocationId } from './recipe-stock-location.util';

describe('resolveRecipeStockLocationId', () => {
  it('accepts positive location id', () => {
    expect(resolveRecipeStockLocationId(5)).toBe(5);
    expect(resolveRecipeStockLocationId('12')).toBe(12);
  });

  it('rejects missing location', () => {
    expect(() => resolveRecipeStockLocationId(undefined)).toThrow(
      BadRequestException,
    );
    expect(() => resolveRecipeStockLocationId(null)).toThrow(
      BadRequestException,
    );
    expect(() => resolveRecipeStockLocationId(0)).toThrow(BadRequestException);
  });
});
