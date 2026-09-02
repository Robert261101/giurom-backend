import { describe, expect, it } from '@jest/globals';
import {
  isPlatformSubscriptionAdmin,
  isPlanCode,
  isPlanUpgrade,
  isPlanDowngrade,
  getPlanRank,
  normalizePlanLimits,
  LIMIT_KEYS,
} from './subscription.constants';

describe('subscription.constants', () => {
  it('accepts free/silver/gold', () => {
    expect(isPlanCode('free')).toBe(true);
    expect(isPlanCode('silver')).toBe(true);
    expect(isPlanCode('gold')).toBe(true);
    expect(isPlanCode('platinum')).toBe(false);
  });

  it('ranks plans and detects upgrades and downgrades', () => {
    expect(getPlanRank('free')).toBe(0);
    expect(getPlanRank('silver')).toBe(1);
    expect(getPlanRank('gold')).toBe(2);
    expect(isPlanUpgrade('free', 'silver')).toBe(true);
    expect(isPlanUpgrade('silver', 'gold')).toBe(true);
    expect(isPlanUpgrade('gold', 'silver')).toBe(false);
    expect(isPlanUpgrade('silver', 'silver')).toBe(false);
    expect(isPlanDowngrade('gold', 'silver')).toBe(true);
    expect(isPlanDowngrade('silver', 'free')).toBe(true);
    expect(isPlanDowngrade('gold', 'free')).toBe(true);
    expect(isPlanDowngrade('free', 'silver')).toBe(false);
    expect(isPlanDowngrade('silver', 'silver')).toBe(false);
  });

  it('blocks tenant admin with company_id from platform subscription admin', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: 15,
        isSuperAdmin: true,
        hasPlatformWideAccess: true,
        permissions: ['assignment.read_all'],
        roles: ['admin'],
      }),
    ).toBe(false);
  });

  it('blocks tenant with company_id snake_case from platform subscription admin', () => {
    expect(
      isPlatformSubscriptionAdmin({
        company_id: 15,
        roles: ['admin'],
      }),
    ).toBe(false);
    expect(
      isPlatformSubscriptionAdmin({
        company_id: 15,
        permissions: ['assignment.read_all'],
      }),
    ).toBe(false);
  });

  it('allows platform user without company_id', () => {
    expect(
      isPlatformSubscriptionAdmin({
        companyId: null,
        permissions: ['assignment.read_all'],
      }),
    ).toBe(true);
  });

  it('normalizePlanLimits merges defaults', () => {
    const limits = normalizePlanLimits([
      { limit_key: LIMIT_KEYS.ACCOUNT_MAX, limit_value: 3 },
    ]);
    expect(limits[LIMIT_KEYS.ACCOUNT_MAX]).toBe(3);
    expect(limits[LIMIT_KEYS.MANUAL_MAX]).toBe(3);
  });
});
