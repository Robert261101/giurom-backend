/**
 * Jest: npx jest src/suppliers/supplier-quota.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import {
  SupplierQuotaService,
  SUPPLIER_LIMIT_KEYS,
} from './supplier-quota.service';

function buildQuotaService(overrides: Record<string, any> = {}) {
  const clientSupplierLinkRepo = {
    count: jest.fn(async () => 0),
    ...(overrides.clientSupplierLinkRepo || {}),
  };
  const supplierLocationsRepo = {
    createQueryBuilder: jest.fn(),
    ...(overrides.supplierLocationsRepo || {}),
  };
  const connection = {
    query: jest.fn(async (sql: string) => {
      if (String(sql).includes('GET_LOCK')) return [{ acquired: 1 }];
      return [{ released: 1 }];
    }),
  };
  const httpService = {
    get: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'COMPANIES_HTTP_URL') return 'http://localhost:3003';
      if (key === 'SERVICE_SECRET') return 'secret';
      return undefined;
    }),
  };

  const service = new SupplierQuotaService(
    clientSupplierLinkRepo as any,
    supplierLocationsRepo as any,
    connection as any,
    httpService as any,
    configService as any,
  );

  return {
    service,
    clientSupplierLinkRepo,
    supplierLocationsRepo,
    connection,
    httpService,
  };
}

describe('SupplierQuotaService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('FREE account 0/1 connect OK; 1/1 blocks', async () => {
    const { service, clientSupplierLinkRepo } = buildQuotaService();
    jest.spyOn(service, 'getSupplierLimits').mockResolvedValue({
      plan_code: 'free',
      plan_name: 'Free',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 1,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 3,
      },
    });

    clientSupplierLinkRepo.count.mockResolvedValue(0);
    await expect(
      service.assertCanConnectAccountSupplier(15),
    ).resolves.toBeTruthy();

    clientSupplierLinkRepo.count.mockResolvedValue(1);
    await expect(service.assertCanConnectAccountSupplier(15)).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'SUPPLIER_ACCOUNT_LIMIT_REACHED',
          error: 'SUBSCRIPTION_LIMIT_REACHED',
        }),
      }),
    );
    await expect(service.assertCanConnectAccountSupplier(15)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('account usage counts active-quota client_supplier_links only', async () => {
    const { service, clientSupplierLinkRepo } = buildQuotaService();
    clientSupplierLinkRepo.count.mockResolvedValue(2);
    await expect(service.countAccountSuppliers(9)).resolves.toBe(2);
    expect(clientSupplierLinkRepo.count).toHaveBeenCalledWith({
      where: { client_company_id: 9, quota_status: 'active' },
    });
  });

  it('FREE manual 2/3 OK; 3/3 blocks', async () => {
    const { service } = buildQuotaService();
    jest.spyOn(service, 'getSupplierLimits').mockResolvedValue({
      plan_code: 'free',
      plan_name: 'Free',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 1,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 3,
      },
    });
    jest
      .spyOn(service, 'countManualSuppliers')
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    await expect(
      service.assertCanCreateManualSupplier(15, [1, 2]),
    ).resolves.toBeTruthy();

    await expect(
      service.assertCanCreateManualSupplier(15, [1, 2]),
    ).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'MANUAL_SUPPLIER_LIMIT_REACHED',
        }),
      }),
    );
  });

  it('SILVER and GOLD expose correct defaults via getSubscriptionUsageView', async () => {
    const { service } = buildQuotaService();
    jest.spyOn(service, 'getSupplierLimits').mockResolvedValue({
      plan_code: 'silver',
      plan_name: 'Silver',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 3,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 7,
      },
    });
    jest.spyOn(service, 'getSupplierUsage').mockResolvedValue({
      account_used: 2,
      manual_used: 5,
    });
    const silver = await service.getSubscriptionUsageView(15, [1]);
    expect(silver.account_limit).toBe(3);
    expect(silver.manual_limit).toBe(7);
    expect(silver.account_over_limit).toBe(false);

    jest.spyOn(service, 'getSupplierLimits').mockResolvedValue({
      plan_code: 'gold',
      plan_name: 'Gold',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 10,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 25,
      },
    });
    jest.spyOn(service, 'getSupplierUsage').mockResolvedValue({
      account_used: 11,
      manual_used: 5,
    });
    const gold = await service.getSubscriptionUsageView(1, [1]);
    expect(gold.account_limit).toBe(10);
    expect(gold.manual_limit).toBe(25);
    expect(gold.account_over_limit).toBe(true);
  });

  it('countManualSuppliers uses DISTINCT (not location rows)', async () => {
    const { service, supplierLocationsRepo } = buildQuotaService();
    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ cnt: 1 })),
    };
    supplierLocationsRepo.createQueryBuilder.mockReturnValue(qb);
    const count = await service.countManualSuppliers(15, [1, 2, 3, 4, 5]);
    expect(count).toBe(1);
    expect(qb.select).toHaveBeenCalledWith(
      'COUNT(DISTINCT sl.supplier_id)',
      'cnt',
    );
  });

  it('withCompanySupplierQuotaLock acquires and releases lock', async () => {
    const { service, connection } = buildQuotaService();
    const result = await service.withCompanySupplierQuotaLock(15, async () => 42);
    expect(result).toBe(42);
    expect(connection.query).toHaveBeenCalledWith(
      'SELECT GET_LOCK(?, 10) AS acquired',
      ['giurom_supplier_quota_15'],
    );
    expect(connection.query).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', [
      'giurom_supplier_quota_15',
    ]);
  });

  it('downgrade over-limit still blocks new connect without deleting', async () => {
    const { service, clientSupplierLinkRepo } = buildQuotaService();
    jest.spyOn(service, 'getSupplierLimits').mockResolvedValue({
      plan_code: 'silver',
      plan_name: 'Silver',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 3,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 7,
      },
    });
    clientSupplierLinkRepo.count.mockResolvedValue(5);
    await expect(service.assertCanConnectAccountSupplier(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
