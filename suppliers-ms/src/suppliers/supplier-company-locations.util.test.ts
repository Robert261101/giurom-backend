/**
 * Jest: npx jest --testPathPattern=supplier-company-locations.util
 */
import { describe, expect, it } from '@jest/globals';
import {
  isManualOwnerCompanyId,
  mergeUniquePositiveIds,
  missingLocationIds,
} from './supplier-company-locations.util';

describe('supplier-company-locations.util', () => {
  it('mergeUniquePositiveIds dedupes and drops invalid', () => {
    expect(mergeUniquePositiveIds([1, 2, 2], [2, 3, 0, -1, NaN as any])).toEqual([
      1, 2, 3,
    ]);
  });

  it('missingLocationIds returns only gaps', () => {
    expect(missingLocationIds([10, 20, 30], [20])).toEqual([10, 30]);
    expect(missingLocationIds([10, 20], [10, 20])).toEqual([]);
  });

  it('isManualOwnerCompanyId', () => {
    expect(isManualOwnerCompanyId(null)).toBe(true);
    expect(isManualOwnerCompanyId(undefined)).toBe(true);
    expect(isManualOwnerCompanyId(0)).toBe(true);
    expect(isManualOwnerCompanyId(9)).toBe(false);
  });
});
