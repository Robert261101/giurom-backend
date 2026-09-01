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
    })),
    ...(overrides.planRepo || {}),
  };
  const planLimitRepo = {
    find: jest.fn(async ({ where }: { where: { plan_code: string } }) => {
      const limits: Record<string, Array<{ limit_key: string; limit_value: number }>> = {
        free: [
          { limit_key: 'suppliers.account.max', limit_value: 1 },
          { limit_key: 'suppliers.manual.max', limit_value: 3 },
        ],
        silver: [
          { limit_key: 'suppliers.account.max', limit_value: 3 },
          { limit_key: 'suppliers.manual.max', limit_value: 7 },
        ],
        gold: [
          { limit_key: 'suppliers.account.max', limit_value: 10 },
          { limit_key: 'suppliers.manual.max', limit_value: 25 },
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
      if (key === 'SERVICE_SECRET') return 'secret';
      return undefined;
    }),
  };

  const service = new SubscriptionService(
    companyRepo as any,
    planRepo as any,
    planLimitRepo as any,
    subscriptionRepo as any,
    httpService as any,
    configService as any,
  );

  return { service, companyRepo, planRepo, planLimitRepo, subscriptionRepo, httpService };
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

  it('blocks furnizor tenant', async () => {
    const { service } = buildSubscriptionService();
    await expect(
      service.changeMySubscription(
        { companyId: 9, companyType: 'furnizor' },
        'silver',
        1,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
