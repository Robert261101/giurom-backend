/**
 * Jest: npx jest src/company/subscription.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { SubscriptionService } from './subscription.service';

function buildSubscriptionService(
  overrides: Record<string, any> = {},
  initialPlan: string = 'free',
) {
  const companyRepo = {
    findOne: jest.fn(async () => ({ id: 15, company_type: 'client' })),
    ...(overrides.companyRepo || {}),
  };
  const planRepo = {
    findOne: jest.fn(async ({ where }: { where: { code: string } }) => ({
      code: where.code,
      name: where.code.charAt(0).toUpperCase() + where.code.slice(1),
      is_active: true,
      sort_order: where.code === 'free' ? 1 : where.code === 'silver' ? 2 : 3,
      price: where.code === 'free' ? '0' : null,
      currency: 'RON',
      billing_period: where.code === 'free' ? 'none' : 'monthly',
      billing_period_days: where.code === 'free' ? null : 30,
      description: null,
    })),
    find: jest.fn(async () => [
      {
        code: 'free',
        name: 'Free',
        is_active: true,
        sort_order: 1,
        price: '0',
        currency: 'RON',
        billing_period: 'none',
        billing_period_days: null,
        description: null,
      },
      {
        code: 'silver',
        name: 'Silver',
        is_active: true,
        sort_order: 2,
        price: null,
        currency: 'RON',
        billing_period: 'monthly',
        billing_period_days: 30,
        description: null,
      },
      {
        code: 'gold',
        name: 'Gold',
        is_active: true,
        sort_order: 3,
        price: null,
        currency: 'RON',
        billing_period: 'monthly',
        billing_period_days: 30,
        description: null,
      },
    ]),
    ...(overrides.planRepo || {}),
  };
  const planLimitRepo = {
    find: jest.fn(async ({ where }: { where: { plan_code: string } }) => {
      const limits: Record<string, Array<{ limit_key: string; limit_value: number }>> = {
        free: [
          { limit_key: 'suppliers.account.max', limit_value: 1 },
          { limit_key: 'suppliers.manual.max', limit_value: 3 },
          { limit_key: 'locations.max', limit_value: 1 },
          { limit_key: 'clients.max', limit_value: 3 },
          { limit_key: 'staff.warehouse.max', limit_value: 1 },
          { limit_key: 'staff.driver.max', limit_value: 1 },
        ],
        silver: [
          { limit_key: 'suppliers.account.max', limit_value: 3 },
          { limit_key: 'suppliers.manual.max', limit_value: 7 },
          { limit_key: 'locations.max', limit_value: 3 },
          { limit_key: 'clients.max', limit_value: 15 },
          { limit_key: 'staff.warehouse.max', limit_value: 3 },
          { limit_key: 'staff.driver.max', limit_value: 5 },
        ],
        gold: [
          { limit_key: 'suppliers.account.max', limit_value: 10 },
          { limit_key: 'suppliers.manual.max', limit_value: 25 },
          { limit_key: 'locations.max', limit_value: 10 },
          { limit_key: 'clients.max', limit_value: 50 },
          { limit_key: 'staff.warehouse.max', limit_value: 10 },
          { limit_key: 'staff.driver.max', limit_value: 15 },
        ],
      };
      return limits[where.plan_code] || limits.free;
    }),
    ...(overrides.planLimitRepo || {}),
  };
  const subscriptionState = {
    company_id: 15,
    plan_code: initialPlan,
    status: 'active',
    starts_at: new Date(),
    ends_at: null,
    updated_by_user_id: null as number | null,
  };
  const subscriptionRepo = {
    findOne: jest.fn(async () => ({ ...subscriptionState })),
    save: jest.fn(async (sub: any) => {
      Object.assign(subscriptionState, sub);
      return sub;
    }),
    create: jest.fn((data: any) => data),
    ...(overrides.subscriptionRepo || {}),
  };
  const invoiceRepo = {
    findAndCount: jest.fn(async () => [[], 0]),
    ...(overrides.invoiceRepo || {}),
  };
  const httpService = {
    get: jest.fn(() =>
      of({
        data: {
          requires_blocks: false,
          account: { minimum_to_block: 0 },
          manual: { minimum_to_block: 0 },
        },
      }),
    ),
    post: jest.fn(() => of({ data: { rollback_items: [] } })),
    ...(overrides.httpService || {}),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'SUPPLIERS_HTTP_URL') return 'http://localhost:3007';
      if (key === 'LOCATIONS_HTTP_URL') return 'http://localhost:3004';
      if (key === 'SERVICE_SECRET') return 'secret';
      return undefined;
    }),
  };

  const planFeatureRepo = {
    find: jest.fn(
      async ({ where }: { where: { plan_code: string; company_type: string } }) => {
        const catalog: Record<string, Record<string, string[]>> = {
          client: {
            free: ['dashboard', 'comenzi', 'furnizori', 'locatii', 'necesar'],
            silver: ['dashboard', 'comenzi', 'furnizori', 'locatii', 'necesar', 'angajati', 'pontaj'],
            gold: ['dashboard', 'comenzi', 'furnizori', 'locatii', 'necesar', 'angajati', 'pontaj', 'rapoarte'],
          },
          furnizor: {
            free: ['dashboard', 'comenzi', 'clienti', 'stoc', 'locatii', 'angajati', 'pontaj', 'staff_ops'],
            silver: ['dashboard', 'comenzi', 'clienti', 'stoc', 'locatii', 'angajati', 'pontaj', 'staff_ops', 'sarcini', 'evenimente'],
            gold: ['dashboard', 'comenzi', 'clienti', 'stoc', 'locatii', 'angajati', 'pontaj', 'staff_ops', 'sarcini', 'evenimente', 'concedii', 'rapoarte'],
          },
        };
        return (catalog[where.company_type]?.[where.plan_code] || []).map((feature_key) => ({ feature_key }));
      },
    ),
    ...(overrides.planFeatureRepo || {}),
  };

  const service = new SubscriptionService(
    companyRepo as any,
    planRepo as any,
    planLimitRepo as any,
    subscriptionRepo as any,
    invoiceRepo as any,
    httpService as any,
    configService as any,
    planFeatureRepo as any,
  );

  return { service, companyRepo, planRepo, planLimitRepo, planFeatureRepo, subscriptionRepo, invoiceRepo, httpService };
}

describe('SubscriptionService.changeMySubscription', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const clientRequester = {
    companyId: 15,
    companyType: 'client' as const,
  };

  it('activates Silver immediately for Free client', async () => {
    const { service, subscriptionRepo } = buildSubscriptionService();
    const result = await service.changeMySubscription(
      clientRequester,
      'silver',
      99,
    );
    expect(result.plan.code).toBe('silver');
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('downgrade without surplus applies plan directly', async () => {
    const { service, subscriptionRepo, httpService } = buildSubscriptionService({}, 'gold');
    const result = await service.changeMySubscription(
      clientRequester,
      'silver',
      7,
    );
    expect(result.plan.code).toBe('silver');
    expect(httpService.get).toHaveBeenCalled();
    expect(httpService.post).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('downgrade with surplus requires block selection', async () => {
    const { service, httpService } = buildSubscriptionService({}, 'gold');
    httpService.get.mockReturnValue(
      of({
        data: {
          requires_blocks: true,
          account: { minimum_to_block: 2, used: 5, limit: 3 },
          manual: { minimum_to_block: 0, used: 2, limit: 7 },
        },
      }),
    );
    await expect(
      service.changeMySubscription(clientRequester, 'silver', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('downgrade with valid blocks applies blocks then plan', async () => {
    const { service, subscriptionRepo, httpService } = buildSubscriptionService({}, 'gold');
    httpService.get.mockReturnValue(
      of({
        data: {
          requires_blocks: true,
          account: { minimum_to_block: 2, used: 5, limit: 3 },
          manual: { minimum_to_block: 0, used: 2, limit: 7 },
        },
      }),
    );
    const result = await service.changeMySubscription(
      clientRequester,
      'silver',
      1,
      {
        block_account_supplier_ids: [1, 2, 3],
        block_manual_supplier_ids: [],
      },
    );
    expect(result.plan.code).toBe('silver');
    expect(httpService.post).toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('rejects requester without company_id (fail-closed, no Free fallback)', async () => {
    const { service } = buildSubscriptionService();
    await expect(
      service.changeMySubscription({ roles: ['admin'] } as any, 'silver', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getMySubscription({} as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('furnizor downgrade without surplus activates plan and calls preview', async () => {
    const { service, httpService, subscriptionRepo } = buildSubscriptionService(
      {
        companyRepo: {
          findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
        },
      },
      'gold',
    );
    httpService.get.mockReturnValue(
      of({
        data: {
          requires_blocks: false,
          clients: { minimum_to_block: 0 },
          staff_warehouse: { minimum_to_block: 0 },
          staff_driver: { minimum_to_block: 0 },
          locations: { minimum_to_block: 0 },
        },
      }),
    );
    const result = await service.changeMySubscription(
      { companyId: 9, companyType: 'furnizor' },
      'free',
      1,
    );
    expect(result.plan.code).toBe('free');
    expect(result.company_type).toBe('furnizor');
    expect(httpService.get).toHaveBeenCalled();
    expect(String((httpService.get as jest.Mock).mock.calls[0][0])).toContain(
      'furnizor-downgrade-preview',
    );
    expect(httpService.post).not.toHaveBeenCalled();
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('furnizor downgrade with surplus applies supplier + location blocks then plan', async () => {
    const { service, httpService, subscriptionRepo } = buildSubscriptionService(
      {
        companyRepo: {
          findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
        },
      },
      'gold',
    );
    httpService.get.mockReturnValue(
      of({
        data: {
          requires_blocks: true,
          clients: { minimum_to_block: 1, used: 4, limit: 3 },
          staff_warehouse: { minimum_to_block: 0, used: 1, limit: 1 },
          staff_driver: { minimum_to_block: 0, used: 1, limit: 1 },
          locations: { minimum_to_block: 1, used: 2, limit: 1 },
        },
      }),
    );
    httpService.post.mockReturnValue(of({ data: { rollback_items: [{ kind: 'client' }] } }));
    const result = await service.changeMySubscription(
      { companyId: 9, companyType: 'furnizor' },
      'free',
      1,
      {
        block_client_company_ids: [100],
        block_location_ids: [7],
      },
    );
    expect(result.plan.code).toBe('free');
    expect(httpService.post).toHaveBeenCalled();
    const postUrls = (httpService.post as jest.Mock).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(postUrls.some((u) => u.includes('apply-furnizor-downgrade-blocks'))).toBe(
      true,
    );
    expect(
      postUrls.some((u) =>
        u.includes('/locations/internal/companies/9/subscription/apply-downgrade-blocks'),
      ),
    ).toBe(true);
    expect(subscriptionRepo.save).toHaveBeenCalled();
  });

  it('furnizor downgrade with surplus requires block selection', async () => {
    const { service, httpService } = buildSubscriptionService(
      {
        companyRepo: {
          findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
        },
      },
      'gold',
    );
    httpService.get.mockReturnValue(
      of({
        data: {
          requires_blocks: true,
          clients: { minimum_to_block: 2, used: 5, limit: 3 },
          staff_warehouse: { minimum_to_block: 0 },
          staff_driver: { minimum_to_block: 0 },
          locations: { minimum_to_block: 0 },
        },
      }),
    );
    await expect(
      service.changeMySubscription(
        { companyId: 9, companyType: 'furnizor' },
        'free',
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('furnizor upgrade activates plan and returns furnizor features', async () => {
    const { service } = buildSubscriptionService({
      companyRepo: {
        findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
      },
    });
    const result = await service.changeMySubscription(
      { companyId: 9, companyType: 'furnizor' },
      'silver',
      1,
    );
    expect(result.plan.code).toBe('silver');
    expect(result.features).toEqual(
      expect.arrayContaining(['sarcini', 'evenimente', 'staff_ops']),
    );
    expect(result.features).not.toContain('rapoarte');
    expect(result.available_plans?.map((p) => p.code)).toEqual([
      'free',
      'silver',
      'gold',
    ]);
  });
});

describe('SubscriptionService.getSubscriptionForCompany (generic, features, limits by type)', () => {
  it('client view: features + client limit keys only (no clients/staff quotas)', async () => {
    const { service } = buildSubscriptionService({}, 'silver');
    const view = await service.getSubscriptionForCompany(15);
    expect(view.company_type).toBe('client');
    expect(view.plan.code).toBe('silver');
    expect(view.features).toEqual(
      expect.arrayContaining(['angajati', 'pontaj', 'comenzi']),
    );
    expect(view.features).not.toContain('rapoarte');
    expect(Object.keys(view.limits).sort()).toEqual(
      ['locations.max', 'suppliers.account.max', 'suppliers.manual.max'].sort(),
    );
    expect(view.limits['locations.max']).toBe(3);
    expect(view.gating_mode).toBe('enforce');
  });

  it('furnizor view: furnizor features + furnizor limits (no account/manual)', async () => {
    const { service } = buildSubscriptionService({
      companyRepo: {
        findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
      },
    });
    const view = await service.getSubscriptionForCompany(9);
    expect(view.company_type).toBe('furnizor');
    expect(view.features).toEqual(
      expect.arrayContaining(['pontaj', 'staff_ops', 'clienti']),
    );
    expect(view.features).not.toContain('sarcini');
    expect(Object.keys(view.limits).sort()).toEqual(
      ['clients.max', 'locations.max', 'staff.driver.max', 'staff.warehouse.max'].sort(),
    );
    expect(view.limits['suppliers.account.max']).toBeUndefined();
  });

  it('ensureDefaultFreeSubscription now creates Free for furnizor', async () => {
    const { service, subscriptionRepo } = buildSubscriptionService({
      companyRepo: {
        findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
      },
      subscriptionRepo: {
        findOne: jest.fn(async () => null),
        save: jest.fn(async (s: any) => s),
        create: jest.fn((d: any) => d),
      },
    });
    await service.ensureDefaultFreeSubscription(9);
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 9, plan_code: 'free' }),
    );
  });
});

describe('SubscriptionService.getMyUsage (aggregate)', () => {
  it('furnizor: locations + clients + staff items with freeze enforcement', async () => {
    const { service, httpService } = buildSubscriptionService({
      companyRepo: {
        findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
      },
    });
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/locations/internal/companies/9/count')) {
        return of({ data: { company_id: 9, count: 1 } });
      }
      if (url.includes('/suppliers/internal/companies/9/quota-usage')) {
        return of({
          data: {
            clients_used: 3,
            staff_warehouse_used: 0,
            staff_driver_used: 2,
          },
        });
      }
      return throwError(() => new Error('unexpected url ' + url));
    });
    const usage = await service.getMyUsage({ companyId: 9, companyType: 'furnizor' });
    expect(usage.company_type).toBe('furnizor');
    const byKey = Object.fromEntries(usage.items.map((i) => [i.limit_key, i]));
    expect(byKey['locations.max']).toMatchObject({ used: 1, limit: 1, reached: true, over_limit: false, enforcement: 'freeze' });
    expect(byKey['clients.max']).toMatchObject({ used: 3, limit: 3, reached: true });
    expect(byKey['staff.warehouse.max']).toMatchObject({ used: 0, limit: 1, reached: false, remaining: 1 });
    expect(byKey['staff.driver.max']).toMatchObject({ used: 2, limit: 1, reached: true, over_limit: true });
    expect(byKey['suppliers.account.max']).toBeUndefined();
  });

  it('client: account/manual (block) + locations (freeze); unreachable source → unavailable, not error', async () => {
    const { service, httpService } = buildSubscriptionService({}, 'gold');
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/quota-usage')) {
        return of({ data: { account_used: 4, manual_used: 2 } });
      }
      return throwError(() => new Error('locations down'));
    });
    const usage = await service.getMyUsage({ companyId: 15, companyType: 'client' });
    const byKey = Object.fromEntries(usage.items.map((i) => [i.limit_key, i]));
    expect(byKey['suppliers.account.max']).toMatchObject({ used: 4, limit: 10, enforcement: 'block' });
    expect(byKey['suppliers.manual.max']).toMatchObject({ used: 2, limit: 25, enforcement: 'block' });
    expect(byKey['locations.max']).toMatchObject({ used: null, limit: 10, unavailable: true, reached: false });
  });

  it('previewMyDowngrade reports frozen usage against target limits without blocking', async () => {
    const { service, httpService } = buildSubscriptionService(
      {
        companyRepo: {
          findOne: jest.fn(async () => ({ id: 9, company_type: 'furnizor' })),
        },
      },
      'gold',
    );
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/count')) return of({ data: { count: 4 } });
      return of({ data: { clients_used: 10, staff_warehouse_used: 2, staff_driver_used: 1 } });
    });
    const preview = await service.previewMyDowngrade({ companyId: 9, companyType: 'furnizor' }, 'free');
    expect(preview.is_downgrade).toBe(true);
    const byKey = Object.fromEntries(preview.frozen_usage.map((i) => [i.limit_key, i]));
    expect(byKey['locations.max']).toMatchObject({ used: 4, limit: 1, over_limit: true });
    expect(byKey['clients.max']).toMatchObject({ used: 10, limit: 3, over_limit: true });
    expect(byKey['staff.driver.max']).toMatchObject({ used: 1, limit: 1, over_limit: false, reached: true });
    expect(httpService.post).not.toHaveBeenCalled();
  });
});
