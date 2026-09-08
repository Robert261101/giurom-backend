/**
 * Jest: npm test -- plan-access.nest  (from locations/)
 * Covers the NestJS adapter shared (copied) across microservices.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createCompanyPlanClient } from '@giurom/tenant-access';
import {
  PLAN_FEATURE_METADATA_KEY,
  PlanAccessService,
  PlanFeatureGuard,
} from './plan-access.nest';

const clientGold = {
  company_type: 'client',
  plan: { code: 'gold', name: 'Gold' },
  status: 'active',
  features: ['dashboard', 'pontaj', 'incasare'],
  limits: {},
};

function buildGuard(
  featureKey: string | undefined,
  payload: unknown,
  ok = true,
) {
  const fetchImpl = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  }));
  const planAccess = new PlanAccessService();
  (planAccess as any).client = createCompanyPlanClient({
    companiesUrl: 'http://company',
    serviceSecret: 's',
    serviceName: 'locations',
    fetchImpl: fetchImpl as any,
    cacheTtlMs: 0,
  });
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === PLAN_FEATURE_METADATA_KEY ? featureKey : undefined,
    ),
  };
  const guard = new PlanFeatureGuard(reflector as any, planAccess);
  return { guard, fetchImpl };
}

function ctx(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('PlanFeatureGuard (NestJS adapter)', () => {
  const originalMode = process.env.PLAN_GATING_MODE;
  afterEach(() => {
    if (originalMode == null) delete process.env.PLAN_GATING_MODE;
    else process.env.PLAN_GATING_MODE = originalMode;
  });

  it('allows routes without @RequiresPlanFeature and never calls company-ms', async () => {
    const { guard, fetchImpl } = buildGuard(undefined, clientGold);
    await expect(guard.canActivate(ctx({ user: null }))).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exempts internal calls flagged with bypassAuth or internalService', async () => {
    const { guard, fetchImpl } = buildGuard('pontaj', clientGold);
    await expect(guard.canActivate(ctx({ bypassAuth: true }))).resolves.toBe(true);
    await expect(
      guard.canActivate(ctx({ internalService: 'employees', user: { sub: 'internal' } })),
    ).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows when the company plan includes the feature', async () => {
    const { guard } = buildGuard('pontaj', clientGold);
    await expect(
      guard.canActivate(ctx({ user: { company_id: 7, permissions: [] } })),
    ).resolves.toBe(true);
  });

  it('denies with PLAN_FEATURE_DENIED when the feature is not in the plan', async () => {
    const { guard } = buildGuard('retetar', clientGold);
    const err = await guard
      .canActivate(ctx({ user: { company_id: 7, permissions: [] } }))
      .catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: 'PLAN_FEATURE_DENIED',
    });
  });

  it('fails closed (403 PLAN_COMPANY_UNRESOLVED) when the tenant company cannot be resolved', async () => {
    const { guard, fetchImpl } = buildGuard('pontaj', clientGold);
    const err = await guard
      .canActivate(ctx({ user: { permissions: ['attendance.read'], roles: ['angajat'] } }))
      .catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: 'PLAN_COMPANY_UNRESOLVED',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed (503) when company-ms is unreachable', async () => {
    const { guard } = buildGuard('pontaj', { message: 'boom' }, false);
    const err = await guard
      .canActivate(ctx({ user: { company_id: 7, permissions: [] } }))
      .catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
  });

  it('exempts platform-wide (superadmin, no tenant company) users', async () => {
    const { guard, fetchImpl } = buildGuard('pontaj', clientGold);
    await expect(
      guard.canActivate(ctx({ user: { isSuperAdmin: true, permissions: [] } })),
    ).resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('PLAN_GATING_MODE=off disables enforcement; =log allows but does not throw', async () => {
    process.env.PLAN_GATING_MODE = 'off';
    let built = buildGuard('retetar', clientGold);
    await expect(
      built.guard.canActivate(ctx({ user: { company_id: 7, permissions: [] } })),
    ).resolves.toBe(true);

    process.env.PLAN_GATING_MODE = 'log';
    built = buildGuard('retetar', clientGold);
    await expect(
      built.guard.canActivate(ctx({ user: { company_id: 7, permissions: [] } })),
    ).resolves.toBe(true);
  });
});
