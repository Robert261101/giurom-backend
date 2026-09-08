/**
 * Jest: npx jest src/suppliers/supplier-quota-lifecycle.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupplierQuotaLifecycleService } from './supplier-quota-lifecycle.service';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';
import { SUPPLIER_LIMIT_KEYS } from './supplier-quota.service';

function buildLifecycleService(overrides: Record<string, any> = {}) {
  const clientSupplierLinkRepo = {
    count: jest.fn(async () => 0),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
    ...(overrides.clientSupplierLinkRepo || {}),
  };
  const manualStateRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
    remove: jest.fn(async () => undefined),
    ...(overrides.manualStateRepo || {}),
  };
  const supplierRepo = {
    findOne: jest.fn(async () => ({ id: 1, owner_company_id: null })),
    ...(overrides.supplierRepo || {}),
  };
  const supplierLocationsRepo = {
    createQueryBuilder: jest.fn(),
    ...(overrides.supplierLocationsRepo || {}),
  };
  const supplierOrderRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(async () => 0),
    })),
    ...(overrides.supplierOrderRepo || {}),
  };
  const connection = { query: jest.fn() };
  const supplierQuotaService = {
    withCompanySupplierQuotaLock: jest.fn(
      async (_cid: number, fn: () => Promise<any>) => fn(),
    ),
    getSupplierLimits: jest.fn(async () => ({
      plan_code: 'silver',
      plan_name: 'Silver',
      status: 'active',
      limits: {
        [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 3,
        [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 7,
      },
    })),
    assertCanConnectAccountSupplier: jest.fn(async () => ({})),
    assertCanCreateManualSupplier: jest.fn(async () => ({})),
    ...(overrides.supplierQuotaService || {}),
  };

  const service = new SupplierQuotaLifecycleService(
    clientSupplierLinkRepo as any,
    manualStateRepo as any,
    supplierRepo as any,
    supplierLocationsRepo as any,
    supplierOrderRepo as any,
    connection as any,
    supplierQuotaService as any,
  );

  return {
    service,
    clientSupplierLinkRepo,
    manualStateRepo,
    supplierOrderRepo,
    supplierQuotaService,
  };
}

describe('SupplierQuotaLifecycleService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('buildDowngradePreview computes minimum blocks', () => {
    const { service } = buildLifecycleService();
    const preview = service.buildDowngradePreview(
      'silver',
      3,
      7,
      [
        { supplier_id: 1, supplier_name: 'A', is_active: true, quota_status: 'active', has_supplier_account: true },
        { supplier_id: 2, supplier_name: 'B', is_active: false, quota_status: 'active', has_supplier_account: true },
        { supplier_id: 3, supplier_name: 'C', is_active: true, quota_status: 'active', has_supplier_account: true },
        { supplier_id: 4, supplier_name: 'D', is_active: true, quota_status: 'active', has_supplier_account: true },
        { supplier_id: 5, supplier_name: 'E', is_active: true, quota_status: 'active', has_supplier_account: true },
      ],
      [
        { supplier_id: 10, supplier_name: 'M1', is_active: true, quota_status: 'active', has_supplier_account: false },
      ],
    );
    expect(preview.requires_blocks).toBe(true);
    expect(preview.account.minimum_to_block).toBe(2);
    expect(preview.manual.minimum_to_block).toBe(0);
  });

  it('validateDowngradeBlockSelection rejects insufficient account blocks', () => {
    const { service } = buildLifecycleService();
    const preview = service.buildDowngradePreview(
      'free',
      1,
      3,
      [
        { supplier_id: 1, supplier_name: 'A', is_active: true, quota_status: 'active', has_supplier_account: true },
        { supplier_id: 2, supplier_name: 'B', is_active: true, quota_status: 'active', has_supplier_account: true },
      ],
      [],
    );
    expect(() =>
      service.validateDowngradeBlockSelection(preview, [], []),
    ).toThrow(BadRequestException);
    expect(() =>
      service.validateDowngradeBlockSelection(preview, [1], []),
    ).not.toThrow();
  });

  it('remove blocks when active non-terminal orders exist', async () => {
    const link = {
      id: 1,
      client_company_id: 15,
      supplier_id: 9,
      quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
      is_active: true,
    };
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(async () => 1),
    };
    const supplierOrderRepo = { createQueryBuilder: jest.fn(() => qb) };
    const { service } = buildLifecycleService({
      clientSupplierLinkRepo: {
        findOne: jest.fn(async () => link),
      },
      supplierOrderRepo,
    });
    await expect(
      service.removeAccountSupplierFromClient(15, 9),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unblock account supplier without slot is forbidden', async () => {
    const link = {
      id: 1,
      client_company_id: 15,
      supplier_id: 9,
      quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
      is_active: true,
    };
    const { service } = buildLifecycleService({
      clientSupplierLinkRepo: {
        findOne: jest.fn(async () => link),
        count: jest.fn(async () => 3),
      },
    });
    await expect(
      service.unblockAccountSupplier(15, 9),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertSupplierQuotaAccessible rejects blocked Cont supplier for new order', async () => {
    const link = {
      id: 1,
      client_company_id: 16,
      supplier_id: 1,
      quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
      is_active: true,
    };
    const { service } = buildLifecycleService({
      clientSupplierLinkRepo: {
        findOne: jest.fn(async () => link),
      },
    });
    await expect(
      service.assertSupplierQuotaAccessible(
        16,
        { id: 1, owner_company_id: 2 } as any,
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertSupplierQuotaAccessible rejects removed Cont supplier for new order', async () => {
    const link = {
      id: 1,
      client_company_id: 16,
      supplier_id: 1,
      quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
      is_active: true,
    };
    const { service } = buildLifecycleService({
      clientSupplierLinkRepo: {
        findOne: jest.fn(async () => link),
      },
    });
    await expect(
      service.assertSupplierQuotaAccessible(
        16,
        { id: 1, owner_company_id: 2 } as any,
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertSupplierQuotaAccessible allows active Cont supplier for new order', async () => {
    const link = {
      id: 1,
      client_company_id: 16,
      supplier_id: 1,
      quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
      is_active: true,
    };
    const { service } = buildLifecycleService({
      clientSupplierLinkRepo: {
        findOne: jest.fn(async () => link),
      },
    });
    await expect(
      service.assertSupplierQuotaAccessible(
        16,
        { id: 1, owner_company_id: 2 } as any,
        true,
      ),
    ).resolves.toBeUndefined();
  });

  it('assertSupplierQuotaAccessible rejects blocked Manual supplier for new order', async () => {
    const { service } = buildLifecycleService({
      manualStateRepo: {
        findOne: jest.fn(async () => ({
          supplier_id: 10,
          client_company_id: 16,
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        })),
      },
    });
    await expect(
      service.assertSupplierQuotaAccessible(
        16,
        { id: 10, owner_company_id: null } as any,
        false,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertSupplierQuotaAccessible rejects removed Manual supplier for new order', async () => {
    const { service } = buildLifecycleService({
      manualStateRepo: {
        findOne: jest.fn(async () => ({
          supplier_id: 10,
          client_company_id: 16,
          quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
        })),
      },
    });
    await expect(
      service.assertSupplierQuotaAccessible(
        16,
        { id: 10, owner_company_id: null } as any,
        false,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('downgrade Silver 2 Cont to Free requires blocking 1 account supplier', () => {
    const { service } = buildLifecycleService();
    const preview = service.buildDowngradePreview(
      'free',
      1,
      3,
      [
        {
          supplier_id: 1,
          supplier_name: 'Cont A',
          is_active: true,
          quota_status: 'active',
          has_supplier_account: true,
        },
        {
          supplier_id: 2,
          supplier_name: 'Cont B',
          is_active: true,
          quota_status: 'active',
          has_supplier_account: true,
        },
      ],
      [],
    );
    expect(preview.requires_blocks).toBe(true);
    expect(preview.account.used).toBe(2);
    expect(preview.account.limit).toBe(1);
    expect(preview.account.minimum_to_block).toBe(1);
    expect(preview.account.suppliers).toHaveLength(2);
    expect(preview.manual.minimum_to_block).toBe(0);
  });

  it('reactivateManualSupplier restores active quota and is_active for removed client only', async () => {
    const stateA = {
      client_company_id: 1,
      supplier_id: 10,
      quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
      is_active: false,
    };
    const manualStateRepo = {
      findOne: jest.fn(async (opts: any) => {
        const cid = Number(opts?.where?.client_company_id);
        const sid = Number(opts?.where?.supplier_id);
        if (cid === 1 && sid === 10) {
          return { ...stateA };
        }
        if (cid === 2 && sid === 10) {
          return {
            client_company_id: 2,
            supplier_id: 10,
            quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
            is_active: true,
          };
        }
        return null;
      }),
      save: jest.fn(async (x: any) => x),
      create: jest.fn((x: any) => x),
    };
    const { service } = buildLifecycleService({ manualStateRepo });
    await service.reactivateManualSupplier(1, 10, [101]);

    expect(manualStateRepo.save).toHaveBeenCalledTimes(1);
    expect(manualStateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        client_company_id: 1,
        supplier_id: 10,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      }),
    );
  });

  it('listManualSuppliersForQuota uses distinct(true) for MariaDB-safe SQL', async () => {
    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => []),
    };
    const supplierLocationsRepo = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const { service } = buildLifecycleService({ supplierLocationsRepo });

    await service.listManualSuppliersForQuota(15, [101, 102], true);

    expect(qb.select).toHaveBeenCalledWith('s.id', 'supplier_id');
    expect(qb.distinct).toHaveBeenCalledWith(true);
    expect(qb.select).not.toHaveBeenCalledWith(
      'DISTINCT s.id',
      'supplier_id',
    );
  });

  describe('manual quota block', () => {
    it('blockAccountSupplier rejects when non-terminal orders exist for same client', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => 2),
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
        supplierOrderRepo: { createQueryBuilder: jest.fn(() => qb) },
      });

      await expect(service.blockAccountSupplier(15, 9)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'SUPPLIER_BLOCK_BLOCKED_BY_ORDERS',
        }),
      });
      expect(clientSupplierLinkRepo.save).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith(
        'o.company_id = :companyId',
        { companyId: 15 },
      );
    });

    it('blockAccountSupplier allows when only terminal orders exist', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => 0),
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
        supplierOrderRepo: { createQueryBuilder: jest.fn(() => qb) },
      });

      const result = await service.blockAccountSupplier(15, 9);
      expect(result.changed).toBe(true);
      expect(clientSupplierLinkRepo.save).toHaveBeenCalled();
    });

    it('blockAccountSupplier scopes active-order check to client company (not other clients)', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => 0),
      };
      const { service } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
        supplierOrderRepo: { createQueryBuilder: jest.fn(() => qb) },
      });

      await service.blockAccountSupplier(15, 9);
      expect(qb.where).toHaveBeenCalledWith('o.supplier_id = :supplierId', {
        supplierId: 9,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'o.company_id = :companyId',
        { companyId: 15 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'o.status NOT IN (:...terminal)',
        expect.objectContaining({
          terminal: expect.arrayContaining(['delivered', 'cancelled']),
        }),
      );
    });

    it('blockAccountSupplier sets quota_status blocked from active', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
      });

      const result = await service.blockAccountSupplier(15, 9);

      expect(result).toEqual({
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        previous_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        changed: true,
      });
      expect(clientSupplierLinkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        }),
      );
    });

    it('blockAccountSupplier is idempotent when already blocked', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        is_active: true,
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
      });

      const result = await service.blockAccountSupplier(15, 9);

      expect(result.changed).toBe(false);
      expect(result.quota_status).toBe(SUPPLIER_QUOTA_STATUS.BLOCKED);
      expect(clientSupplierLinkRepo.save).not.toHaveBeenCalled();
    });

    it('blockAccountSupplier rejects removed supplier', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
        is_active: true,
      };
      const { service } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
        },
      });

      await expect(service.blockAccountSupplier(15, 9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('blockAccountSupplier keeps association row (not removed)', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
      });

      await service.blockAccountSupplier(15, 9);

      expect(clientSupplierLinkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          client_company_id: 15,
          supplier_id: 9,
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        }),
      );
    });

    it('blockManualSupplier sets quota_status blocked from active', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(async () => [
          {
            supplier_id: 10,
            supplier_name: 'Manual S',
            is_active: 1,
            quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
          },
        ]),
      };
      const { service, manualStateRepo } = buildLifecycleService({
        supplierLocationsRepo: {
          createQueryBuilder: jest.fn(() => qb),
        },
        manualStateRepo: {
          findOne: jest.fn(async () => null),
          save: jest.fn(async (x: any) => x),
          create: jest.fn((x: any) => x),
        },
      });

      const result = await service.blockManualSupplier(15, 10, [101]);

      expect(result).toEqual({
        supplier_id: 10,
        quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        previous_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        changed: true,
      });
      expect(manualStateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          client_company_id: 15,
          supplier_id: 10,
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        }),
      );
    });

    it('blocked supplier is denied for operational access', async () => {
      const link = {
        id: 1,
        client_company_id: 16,
        supplier_id: 1,
        quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        is_active: true,
      };
      const { service } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
        },
      });

      await expect(
        service.assertSupplierQuotaAccessible(
          16,
          { id: 1, owner_company_id: 2 } as any,
          true,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('unblock after manual block restores active quota status', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        is_active: true,
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
          count: jest.fn(async () => 0),
        },
      });

      await service.unblockAccountSupplier(15, 9);

      expect(clientSupplierLinkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        }),
      );
    });

    it('applyDowngradeBlocks uses the same blocked state as manual block', async () => {
      const link = {
        id: 1,
        client_company_id: 15,
        supplier_id: 9,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
        is_active: true,
      };
      const { service, clientSupplierLinkRepo } = buildLifecycleService({
        clientSupplierLinkRepo: {
          find: jest.fn(async () => [
            {
              supplier_id: 9,
              is_active: true,
              quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
              supplier: { supplier_name: 'A' },
            },
          ]),
          findOne: jest.fn(async () => link),
          save: jest.fn(async (x: any) => x),
        },
        supplierLocationsRepo: {
          createQueryBuilder: jest.fn(() => ({
            innerJoin: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            distinct: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn(async () => []),
          })),
        },
      });

      await service.applyDowngradeBlocks({
        companyId: 15,
        companyLocationIds: [101],
        accountLimit: 0,
        manualLimit: 3,
        blockAccountSupplierIds: [9],
        blockManualSupplierIds: [],
      });

      expect(clientSupplierLinkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
        }),
      );
    });
  });
});
