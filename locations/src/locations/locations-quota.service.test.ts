/**
 * Jest: npm test -- locations-quota  (from locations/)
 */
import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { LocationsQuotaService } from './locations-quota.service';
import { PlanAccessService } from '../plan-access/plan-access.nest';
import { createCompanyPlanClient } from '@giurom/tenant-access';

function buildPlanAccess(payload: unknown, ok = true) {
  const fetchImpl = jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload }));
  const service = new PlanAccessService();
  (service as any).client = createCompanyPlanClient({
    companiesUrl: 'http://company',
    serviceSecret: 's',
    serviceName: 'locations',
    fetchImpl: fetchImpl as any,
    cacheTtlMs: 0,
  });
  return service;
}

function buildQuota(count: number, planPayload: unknown, ok = true) {
  const repo = {
    count: jest.fn(async () => count),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (row: any) => row),
  };
  const runner = {
    connect: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string) => (sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [{}])),
    release: jest.fn(async () => undefined),
  };
  const dataSource = { createQueryRunner: jest.fn(() => runner) };
  const svc = new LocationsQuotaService(repo as any, dataSource as any, buildPlanAccess(planPayload, ok));
  return { svc, repo, dataSource, runner };
}

const furnizorFree = {
  company_type: 'furnizor',
  plan: { code: 'free', name: 'Free' },
  status: 'active',
  features: ['locatii'],
  limits: { 'locations.max': 1 },
};

describe('LocationsQuotaService (locations.max, freeze-create)', () => {
  it('allows create when used < limit', async () => {
    const { svc } = buildQuota(0, furnizorFree);
    await expect(svc.assertCanCreateLocation(9)).resolves.toBeUndefined();
  });

  it('denies with 403 LOCATIONS_LIMIT_REACHED when used >= limit (existing data untouched)', async () => {
    const { svc } = buildQuota(1, furnizorFree);
    try {
      await svc.assertCanCreateLocation(9);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const body = (e as ForbiddenException).getResponse() as any;
      expect(body).toMatchObject({
        statusCode: 403,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        code: 'LOCATIONS_LIMIT_REACHED',
        details: { limit_key: 'locations.max', used: 1, limit: 1, plan_code: 'free', company_id: 9 },
      });
    }
  });

  it('counts only active locations for the target company', async () => {
    const { svc, repo } = buildQuota(0, furnizorFree);
    await svc.assertCanCreateLocation(9);
    expect(repo.count).toHaveBeenCalledWith({
      where: { company_id: 9, is_active: true },
    });
  });

  it('downgrade preview minimum_to_block = used - limit', async () => {
    const { svc, repo } = buildQuota(0, furnizorFree);
    repo.find.mockResolvedValue([
      { id: 1, location_name: 'A' },
      { id: 2, location_name: 'B' },
      { id: 3, location_name: 'C' },
    ]);
    const preview = await svc.getDowngradePreview(9, 1);
    expect(preview.requires_blocks).toBe(true);
    expect(preview.locations).toMatchObject({
      limit: 1,
      used: 3,
      minimum_to_block: 2,
    });
    expect(preview.locations.items).toHaveLength(3);
  });

  it('fail-closed: company-ms unreachable → 503, not Free fallback', async () => {
    const { svc } = buildQuota(0, {}, false);
    await expect(svc.assertCanCreateLocation(9)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lock is acquired and released around the create', async () => {
    const { svc, runner } = buildQuota(0, furnizorFree);
    const result = await svc.withCompanyLocationsQuotaLock(9, async () => 'created');
    expect(result).toBe('created');
    const sqls = (runner.query as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toContain('GET_LOCK');
    expect(sqls[1]).toContain('RELEASE_LOCK');
    expect(runner.release).toHaveBeenCalled();
  });

  it('denies Free at 1/1, allows Silver at 2/3, denies Silver at 3/3 and Gold at 10/10', async () => {
    const silver = {
      company_type: 'client',
      plan: { code: 'silver', name: 'Silver' },
      status: 'active',
      features: ['locatii'],
      limits: { 'locations.max': 3 },
    };
    const gold = {
      company_type: 'client',
      plan: { code: 'gold', name: 'Gold' },
      status: 'active',
      features: ['locatii'],
      limits: { 'locations.max': 10 },
    };

    await expect(buildQuota(1, furnizorFree).svc.assertCanCreateLocation(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(buildQuota(2, silver).svc.assertCanCreateLocation(1)).resolves.toBeUndefined();
    await expect(buildQuota(3, silver).svc.assertCanCreateLocation(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(buildQuota(10, gold).svc.assertCanCreateLocation(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('PLAN_GATING_MODE=off skips the check', async () => {
    const prev = process.env.PLAN_GATING_MODE;
    process.env.PLAN_GATING_MODE = 'off';
    try {
      const { svc, repo } = buildQuota(50, furnizorFree);
      await expect(svc.assertCanCreateLocation(9)).resolves.toBeUndefined();
      expect(repo.count).not.toHaveBeenCalled();
    } finally {
      if (prev == null) delete process.env.PLAN_GATING_MODE;
      else process.env.PLAN_GATING_MODE = prev;
    }
  });

  it('reactivate succeeds under limit and sets is_active=true', async () => {
    const loc = { id: 5, company_id: 9, is_active: false };
    const { svc, repo } = buildQuota(0, furnizorFree);
    repo.findOne.mockResolvedValue(loc);
    await svc.reactivateLocation(9, 5);
    expect(loc.is_active).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(loc);
  });

  it('reactivate fails at limit with LOCATIONS_LIMIT_REACHED', async () => {
    const loc = { id: 5, company_id: 9, is_active: false };
    const { svc, repo } = buildQuota(1, furnizorFree);
    repo.findOne.mockResolvedValue(loc);
    try {
      await svc.reactivateLocation(9, 5);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'LOCATIONS_LIMIT_REACHED',
      });
    }
    expect(loc.is_active).toBe(false);
  });

  it('reactivate wrong company → NotFound (tenant isolation)', async () => {
    const { svc, repo } = buildQuota(0, furnizorFree);
    repo.findOne.mockResolvedValue(null);
    await expect(svc.reactivateLocation(9, 5)).rejects.toMatchObject({
      message: expect.stringContaining('5'),
    });
  });
});
