/**
 * Jest: npm run test:libs:tenant-access  (from giurom-backend root)
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  PLAN_ACCESS_ERROR_CODES,
  PLAN_LIMIT_KEYS,
  PlanAccessError,
  assertPlanFeature,
  assertPlanLimit,
  createCompanyPlanClient,
  describePlanLimit,
  evaluatePlanFeatureAccess,
  evaluatePlanLimitForCompany,
  hasPlanFeature,
  isPlanGateExempt,
  normalizeCompanyPlanSnapshot,
  resolvePlanCompanyIdOrFail,
  resolvePlanGatingMode,
} from './plan-access';
import type { CompanyPlanSnapshot, PlanFetchImpl } from './plan-access';

const furnizorFree: CompanyPlanSnapshot = {
  company_id: 9,
  company_type: 'furnizor',
  plan_code: 'free',
  plan_name: 'Free',
  status: 'active',
  features: ['dashboard', 'comenzi', 'clienti', 'stoc', 'locatii', 'angajati', 'pontaj', 'staff_ops'],
  limits: {
    [PLAN_LIMIT_KEYS.LOCATIONS_MAX]: 1,
    [PLAN_LIMIT_KEYS.CLIENTS_MAX]: 3,
    [PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX]: 1,
    [PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX]: 1,
  },
  gating_mode: 'enforce',
};

function fakeFetch(body: unknown, ok = true, status = 200): PlanFetchImpl {
  return jest.fn(async () => ({ ok, status, json: async () => body })) as unknown as PlanFetchImpl;
}

describe('resolvePlanGatingMode', () => {
  it.each([
    [undefined, 'enforce'],
    ['', 'enforce'],
    ['enforce', 'enforce'],
    ['garbage', 'enforce'],
    ['OFF', 'off'],
    [' log ', 'log'],
  ])('%p → %s', (raw, expected) => {
    expect(resolvePlanGatingMode(raw as string | undefined)).toBe(expected);
  });
});

describe('normalizeCompanyPlanSnapshot', () => {
  it('normalizes company-ms payload', () => {
    const snap = normalizeCompanyPlanSnapshot(9, {
      company_type: 'Furnizor',
      plan: { code: 'Silver', name: 'Silver' },
      status: 'active',
      features: ['Pontaj', 'pontaj', ' sarcini '],
      limits: { 'locations.max': '3', bad: 'x' },
    });
    expect(snap.company_type).toBe('furnizor');
    expect(snap.plan_code).toBe('silver');
    expect(snap.features).toEqual(['pontaj', 'sarcini']);
    expect(snap.limits).toEqual({ 'locations.max': 3 });
    expect(snap.gating_mode).toBe('enforce');
  });

  it('fails closed on missing company_type or plan', () => {
    expect(() => normalizeCompanyPlanSnapshot(9, { plan: { code: 'free' } })).toThrow(PlanAccessError);
    expect(() => normalizeCompanyPlanSnapshot(9, { company_type: 'client' })).toThrow(PlanAccessError);
    try {
      normalizeCompanyPlanSnapshot(9, {});
    } catch (e) {
      expect((e as PlanAccessError).httpStatus).toBe(503);
      expect((e as PlanAccessError).error).toBe(PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED);
    }
  });
});

describe('features', () => {
  it('hasPlanFeature is case-insensitive and false for missing', () => {
    expect(hasPlanFeature(furnizorFree, 'PONTAJ')).toBe(true);
    expect(hasPlanFeature(furnizorFree, 'sarcini')).toBe(false);
    expect(hasPlanFeature(null, 'pontaj')).toBe(false);
  });

  it('assertPlanFeature throws 403 PLAN_FEATURE_DENIED with details', () => {
    expect(() => assertPlanFeature(furnizorFree, 'pontaj')).not.toThrow();
    try {
      assertPlanFeature(furnizorFree, 'rapoarte');
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as PlanAccessError;
      expect(err.httpStatus).toBe(403);
      expect(err.error).toBe('PLAN_FEATURE_DENIED');
      expect(err.toHttpBody()).toMatchObject({
        statusCode: 403,
        error: 'PLAN_FEATURE_DENIED',
        details: { feature_key: 'rapoarte', plan_code: 'free', company_type: 'furnizor' },
      });
    }
  });
});

describe('limits (freeze-create)', () => {
  it('describePlanLimit computes reached/over_limit', () => {
    expect(describePlanLimit(furnizorFree, PLAN_LIMIT_KEYS.CLIENTS_MAX, 2)).toMatchObject({
      limit: 3, used: 2, remaining: 1, reached: false, over_limit: false,
    });
    expect(describePlanLimit(furnizorFree, PLAN_LIMIT_KEYS.CLIENTS_MAX, 3)).toMatchObject({
      reached: true, over_limit: false, remaining: 0,
    });
    expect(describePlanLimit(furnizorFree, PLAN_LIMIT_KEYS.CLIENTS_MAX, 5)).toMatchObject({
      reached: true, over_limit: true, remaining: 0,
    });
  });

  it('assertPlanLimit allows below limit and denies at/over limit (used >= limit)', () => {
    expect(assertPlanLimit(furnizorFree, PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX, 0).reached).toBe(false);
    expect(() =>
      assertPlanLimit(furnizorFree, PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX, 1, { code: 'STAFF_DRIVER_LIMIT_REACHED' }),
    ).toThrow(PlanAccessError);
    try {
      assertPlanLimit(furnizorFree, PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX, 4, { code: 'STAFF_DRIVER_LIMIT_REACHED' });
    } catch (e) {
      const body = (e as PlanAccessError).toHttpBody();
      expect(body.statusCode).toBe(403);
      expect(body.error).toBe('SUBSCRIPTION_LIMIT_REACHED');
      expect(body.code).toBe('STAFF_DRIVER_LIMIT_REACHED');
      expect(body.details).toMatchObject({ limit_key: 'staff.driver.max', used: 4, limit: 1, plan_code: 'free' });
    }
  });

  it('missing limit key fails closed (503), never permissive', () => {
    try {
      assertPlanLimit(furnizorFree, 'unknown.max', 0);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as PlanAccessError).httpStatus).toBe(503);
    }
  });
});

describe('requester resolution (fail-closed)', () => {
  it('resolvePlanCompanyIdOrFail throws 403 PLAN_COMPANY_UNRESOLVED without company', () => {
    expect(resolvePlanCompanyIdOrFail({ company_id: 4 })).toBe(4);
    try {
      resolvePlanCompanyIdOrFail({ roles: ['admin'] });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as PlanAccessError).error).toBe('PLAN_COMPANY_UNRESOLVED');
      expect((e as PlanAccessError).httpStatus).toBe(403);
    }
  });

  it('isPlanGateExempt: internal + unbound platform yes; bound tenant never', () => {
    expect(isPlanGateExempt({ bypassAuth: true })).toBe(true);
    expect(isPlanGateExempt({ isSuperAdmin: true })).toBe(true);
    expect(isPlanGateExempt({ roles: ['super-admin'], company_id: 5 })).toBe(false);
    expect(isPlanGateExempt({ company_id: 5, roles: ['admin'] })).toBe(false);
    expect(isPlanGateExempt({ roles: ['user'] })).toBe(false);
    expect(isPlanGateExempt(null)).toBe(false);
  });
});

describe('createCompanyPlanClient', () => {
  const payload = {
    company_type: 'furnizor',
    plan: { code: 'free', name: 'Free' },
    status: 'active',
    features: ['pontaj'],
    limits: { 'locations.max': 1 },
  };

  it('fetches with internal headers and caches within TTL', async () => {
    const fetchImpl = fakeFetch(payload);
    const client = createCompanyPlanClient({
      companiesUrl: 'http://company/', serviceSecret: 's3', serviceName: 'locations', fetchImpl, cacheTtlMs: 60000,
    });
    const a = await client.getCompanyPlan(9);
    const b = await client.getCompanyPlan(9);
    expect(a.plan_code).toBe('free');
    expect(b).toBe(a);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('http://company/companies/internal/9/subscription');
    expect(init.headers['x-service-secret']).toBe('s3');
    expect(init.headers['x-internal-service']).toBe('locations');
    client.invalidate(9);
    await client.getCompanyPlan(9);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('non-2xx and network errors → 503 PLAN_RESOLUTION_FAILED', async () => {
    const client = createCompanyPlanClient({
      companiesUrl: 'http://company', serviceSecret: 's', serviceName: 'x', fetchImpl: fakeFetch({}, false, 500),
    });
    await expect(client.getCompanyPlan(9)).rejects.toMatchObject({ httpStatus: 503, error: 'PLAN_RESOLUTION_FAILED' });
    const broken = createCompanyPlanClient({
      companiesUrl: 'http://company', serviceSecret: 's', serviceName: 'x',
      fetchImpl: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as PlanFetchImpl,
    });
    await expect(broken.getCompanyPlan(9)).rejects.toMatchObject({ httpStatus: 503 });
  });

  it('invalid company id → 403 PLAN_COMPANY_UNRESOLVED', async () => {
    const client = createCompanyPlanClient({ companiesUrl: 'http://c', serviceSecret: 's', serviceName: 'x', fetchImpl: fakeFetch(payload) });
    await expect(client.getCompanyPlan(0)).rejects.toMatchObject({ error: 'PLAN_COMPANY_UNRESOLVED' });
  });
});

describe('evaluatePlanFeatureAccess', () => {
  const payload = { company_type: 'client', plan: { code: 'free', name: 'Free' }, features: ['comenzi'], limits: {} };
  const client = () => createCompanyPlanClient({ companiesUrl: 'http://c', serviceSecret: 's', serviceName: 'x', fetchImpl: fakeFetch(payload), cacheTtlMs: 0 });

  it('allows included feature, denies missing feature', async () => {
    expect(await evaluatePlanFeatureAccess(client(), { company_id: 15 }, 'comenzi', 'enforce')).toMatchObject({ allowed: true, reason: 'feature_included' });
    const denied = await evaluatePlanFeatureAccess(client(), { company_id: 15 }, 'pontaj', 'enforce');
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.error.error).toBe('PLAN_FEATURE_DENIED');
  });

  it('fail-closed: no company_id → denied (no Free fallback); RBAC admin role does not help', async () => {
    const denied = await evaluatePlanFeatureAccess(client(), { roles: ['user'], permissions: ['attendance.create'] }, 'pontaj', 'enforce');
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.error.error).toBe('PLAN_COMPANY_UNRESOLVED');
  });

  it('fail-closed: company-ms unreachable → 503', async () => {
    const down = createCompanyPlanClient({ companiesUrl: 'http://c', serviceSecret: 's', serviceName: 'x', fetchImpl: fakeFetch({}, false, 502) });
    const res = await evaluatePlanFeatureAccess(down, { company_id: 15 }, 'comenzi', 'enforce');
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.error.httpStatus).toBe(503);
  });

  it('exempt: internal call and unbound platform operator', async () => {
    expect(await evaluatePlanFeatureAccess(client(), { bypassAuth: true }, 'pontaj', 'enforce')).toMatchObject({ allowed: true, reason: 'exempt' });
    expect(await evaluatePlanFeatureAccess(client(), { isSuperAdmin: true }, 'pontaj', 'enforce')).toMatchObject({ allowed: true, reason: 'exempt' });
  });

  it('modes: off skips, log allows', async () => {
    expect(await evaluatePlanFeatureAccess(client(), {}, 'pontaj', 'off')).toMatchObject({ allowed: true, reason: 'gating_off' });
    expect(await evaluatePlanFeatureAccess(client(), { company_id: 15 }, 'pontaj', 'log')).toMatchObject({ allowed: true, reason: 'log_only' });
  });
});

describe('evaluatePlanLimitForCompany', () => {
  const payload = { company_type: 'furnizor', plan: { code: 'free', name: 'Free' }, features: [], limits: { 'clients.max': 3 } };
  const client = () => createCompanyPlanClient({ companiesUrl: 'http://c', serviceSecret: 's', serviceName: 'x', fetchImpl: fakeFetch(payload), cacheTtlMs: 0 });

  it('allows when used < limit, denies at limit, off skips counting', async () => {
    const count = jest.fn(async () => 2);
    const ok = await evaluatePlanLimitForCompany(client(), 9, 'clients.max', count, { mode: 'enforce' });
    expect(ok?.check).toMatchObject({ used: 2, limit: 3, reached: false });
    await expect(
      evaluatePlanLimitForCompany(client(), 9, 'clients.max', async () => 3, { mode: 'enforce', code: 'SUPPLIER_CLIENTS_LIMIT_REACHED' }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_CLIENTS_LIMIT_REACHED', httpStatus: 403 });
    const skipped = jest.fn(async () => 99);
    expect(await evaluatePlanLimitForCompany(client(), 9, 'clients.max', skipped, { mode: 'off' })).toBeNull();
    expect(skipped).not.toHaveBeenCalled();
    const logged = await evaluatePlanLimitForCompany(client(), 9, 'clients.max', async () => 10, { mode: 'log' });
    expect(logged?.check.over_limit).toBe(true);
  });
});
