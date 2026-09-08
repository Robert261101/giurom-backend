/**
 * Ensures recipes JwtStrategy maps company_id for plan gating.
 * Run: npx jest src/auth/jwt.strategy.test.ts --config jest.config.js
 */
import { describe, expect, it, beforeAll } from '@jest/globals';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy (recipes)', () => {
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-recipes-jwt';
    strategy = new JwtStrategy();
  });

  it('maps company_id from JWT snake_case payload', async () => {
    const user = await strategy.validate({
      sub: 42,
      company_id: 7,
      permissions: ['recipes.read'],
    });
    expect(user.company_id).toBe(7);
  });

  it('falls back to companyId camelCase', async () => {
    const user = await strategy.validate({
      sub: 42,
      companyId: 9,
      permissions: [],
    });
    expect(user.company_id).toBe(9);
  });

  it('prefers company_id when both present', async () => {
    const user = await strategy.validate({
      sub: 1,
      company_id: 3,
      companyId: 99,
    });
    expect(user.company_id).toBe(3);
  });

  it('sets company_id null when absent (fail-closed for plan gate)', async () => {
    const user = await strategy.validate({ sub: 1, permissions: [] });
    expect(user.company_id).toBeNull();
  });
});
