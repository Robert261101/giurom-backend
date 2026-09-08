/**
 * Jest: npm test -- downgrade-blocked-ops  (from suppliers-ms/)
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FurnizorQuotaLifecycleService } from './furnizor-quota-lifecycle.service';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';

describe('FurnizorQuotaLifecycle reactivate / unblock', () => {
  function build(opts?: {
    staffLinks?: any[];
    clientLinks?: any[];
    assertStaffThrow?: Error;
    assertClientThrow?: Error;
  }) {
    const clientSupplierLinkRepo = {
      find: jest.fn(async () => opts?.clientLinks ?? []),
      save: jest.fn(async (row: any) => row),
    };
    const employeeSupplierRepo = {
      find: jest.fn(async () => opts?.staffLinks ?? []),
      save: jest.fn(async (row: any) => row),
    };
    const planQuota = {
      getSupplierIdsForOwnerCompany: jest.fn(async () => [10]),
      withFurnizorQuotaLock: jest.fn(async (_id: number, fn: () => Promise<any>) =>
        fn(),
      ),
      countDistinctClientsForOwnerCompany: jest.fn(async () => 0),
      assertFurnizorCanAssignStaff: jest.fn(async () => {
        if (opts?.assertStaffThrow) throw opts.assertStaffThrow;
      }),
    };
    const planAccess = {
      assertLimitForCompany: jest.fn(async () => {
        if (opts?.assertClientThrow) throw opts.assertClientThrow;
      }),
    };
    const svc = new FurnizorQuotaLifecycleService(
      clientSupplierLinkRepo as any,
      employeeSupplierRepo as any,
      planQuota as any,
      planAccess as any,
    );
    return { svc, clientSupplierLinkRepo, employeeSupplierRepo, planQuota, planAccess };
  }

  it('reactivateStaff succeeds under limit', async () => {
    const link = { id: 1, employee_id: 12, role: 'warehouse', is_active: false, supplier_id: 10 };
    const { svc, employeeSupplierRepo } = build({ staffLinks: [link] });
    await svc.reactivateStaffForOwner(50, 12, 'warehouse');
    expect(link.is_active).toBe(true);
    expect(employeeSupplierRepo.save).toHaveBeenCalledWith(link);
  });

  it('reactivateStaff fails at limit', async () => {
    const link = { id: 1, employee_id: 12, role: 'driver', is_active: false, supplier_id: 10 };
    const limitErr = new ForbiddenException({
      code: 'STAFF_DRIVER_LIMIT_REACHED',
    });
    const { svc } = build({ staffLinks: [link], assertStaffThrow: limitErr });
    await expect(svc.reactivateStaffForOwner(50, 12, 'driver')).rejects.toBe(
      limitErr,
    );
    expect(link.is_active).toBe(false);
  });

  it('reactivateStaff with no Cont suppliers → NotFound (tenant)', async () => {
    const { svc, planQuota } = build({ staffLinks: [] });
    planQuota.getSupplierIdsForOwnerCompany.mockImplementation(async () => []);
    await expect(
      svc.reactivateStaffForOwner(99, 12, 'warehouse'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unblockClient succeeds under limit', async () => {
    const link = {
      id: 1,
      client_company_id: 77,
      supplier_id: 10,
      quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
    };
    const { svc, clientSupplierLinkRepo } = build({ clientLinks: [link] });
    await svc.unblockClientForOwner(50, 77);
    expect(link.quota_status).toBe(SUPPLIER_QUOTA_STATUS.ACTIVE);
    expect(clientSupplierLinkRepo.save).toHaveBeenCalledWith(link);
  });

  it('unblockClient fails at clients.max', async () => {
    const link = {
      id: 1,
      client_company_id: 77,
      supplier_id: 10,
      quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
    };
    const limitErr = new ForbiddenException({
      code: 'SUPPLIER_CLIENTS_LIMIT_REACHED',
    });
    const { svc } = build({ clientLinks: [link], assertClientThrow: limitErr });
    await expect(svc.unblockClientForOwner(50, 77)).rejects.toBe(limitErr);
    expect(link.quota_status).toBe(SUPPLIER_QUOTA_STATUS.BLOCKED);
  });
});

describe('SuppliersService ops asserts for blocked resources', () => {
  function bareService() {
    const svc: any = {
      fetchLocation: jest.fn(),
      fetchLocationOrFail: jest.fn(),
      employeeSupplierRepo: { findOne: jest.fn() },
      orderRepo: { findOne: jest.fn() },
      orderAssignmentRepo: { findOne: jest.fn() },
      logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    };
    // Bind private helpers from prototype by copying implementations via eval-free assign:
    const proto = require('./suppliers.service').SuppliersService.prototype;
    svc.assertLocationActiveForNewOps = proto.assertLocationActiveForNewOps;
    svc.assertEmployeeSupplierLinkActive = proto.assertEmployeeSupplierLinkActive;
    svc.assertClientLocationBelongsToCompany =
      proto.assertClientLocationBelongsToCompany;
    svc.assertLocationBelongsToRequesterCompany =
      proto.assertLocationBelongsToRequesterCompany;
    return svc;
  }

  it('assertLocationActiveForNewOps rejects is_active=false', () => {
    const svc = bareService();
    expect(() =>
      svc.assertLocationActiveForNewOps({ is_active: false }, 3),
    ).toThrow(ForbiddenException);
    try {
      svc.assertLocationActiveForNewOps({ is_active: 0 }, 3);
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'LOCATION_QUOTA_BLOCKED',
      });
    }
  });

  it('assertLocationActiveForNewOps allows active / null', () => {
    const svc = bareService();
    expect(() =>
      svc.assertLocationActiveForNewOps({ is_active: true }, 3),
    ).not.toThrow();
    expect(() =>
      svc.assertLocationActiveForNewOps({ is_active: null }, 3),
    ).not.toThrow();
  });

  it('assertClientLocationBelongsToCompany rejects inactive location', async () => {
    const svc = bareService();
    svc.fetchLocationOrFail.mockResolvedValue({
      location: { id: 3, company_id: 9, is_active: false },
      failed: false,
    });
    await expect(
      svc.assertClientLocationBelongsToCompany.call(svc, 3, 9),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assertEmployeeSupplierLinkActive rejects is_active=false warehouse', () => {
    const svc = bareService();
    expect(() =>
      svc.assertEmployeeSupplierLinkActive({ is_active: false }, 'magazioner'),
    ).toThrow(ForbiddenException);
    expect(() =>
      svc.assertEmployeeSupplierLinkActive({ is_active: true }, 'magazioner'),
    ).not.toThrow();
    expect(() =>
      svc.assertEmployeeSupplierLinkActive({ is_active: null }, 'șofer'),
    ).not.toThrow();
  });

  it('createOrderAssignment path: inactive warehouse link → 403', async () => {
    const { SuppliersService } = require('./suppliers.service');
    const svc: any = Object.create(SuppliersService.prototype);
    svc.findOrderForRequester = jest.fn(async () => ({
      id: 1,
      supplier_id: 10,
    }));
    svc.assertSupplierAccountRequiredForTenantAction = jest.fn(async () => undefined);
    svc.assertEmployeeBelongsToTenantCompany = jest.fn(async () => undefined);
    svc.employeeSupplierRepo = {
      findOne: jest.fn(async () => ({
        employee_id: 5,
        supplier_id: 10,
        role: 'warehouse',
        is_active: false,
      })),
    };
    svc.connection = { transaction: jest.fn() };

    await expect(
      svc.createOrderAssignment(
        1,
        { employee_id: 5 },
        99,
        { userId: 1, company_id: 50 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.connection.transaction).not.toHaveBeenCalled();
  });

  it('upsertStaffLinkForOwnerCompanyInternal does not auto-reactivate soft-blocked link', async () => {
    const { SuppliersService } = require('./suppliers.service');
    const svc: any = Object.create(SuppliersService.prototype);
    const link = {
      employee_id: 12,
      supplier_id: 10,
      role: 'warehouse',
      is_active: false,
    };
    svc.employeeSupplierRepo = {
      findOne: jest.fn(async () => link),
      save: jest.fn(async (row: any) => row),
      create: jest.fn((row: any) => row),
    };
    svc.supplierPlanQuotaService = {
      getSupplierIdsForOwnerCompany: jest.fn(async () => [10]),
      withFurnizorQuotaLock: jest.fn(async (_id: number, fn: () => Promise<any>) =>
        fn(),
      ),
      assertFurnizorCanAssignStaff: jest.fn(async () => undefined),
    };

    await svc.upsertStaffLinkForOwnerCompanyInternal(50, 12, 'warehouse');
    expect(link.is_active).toBe(false);
    expect(
      svc.supplierPlanQuotaService.assertFurnizorCanAssignStaff,
    ).not.toHaveBeenCalled();
  });

  it('createDriverAssignment path: inactive driver link → 403', async () => {
    const { SuppliersService } = require('./suppliers.service');
    const svc: any = Object.create(SuppliersService.prototype);
    svc.findOrderForRequester = jest.fn(async () => ({
      id: 1,
      supplier_id: 10,
      status: 'confirmed',
    }));
    svc.assertSupplierAccountRequiredForTenantAction = jest.fn(async () => undefined);
    const manager = {
      findOne: jest.fn(async (entity: any, opts: any) => {
        if (String(entity?.name || entity).includes('Employee') || opts?.where?.role === 'driver') {
          if (opts?.where?.role === 'driver') {
            return {
              employee_id: 8,
              supplier_id: 10,
              role: 'driver',
              is_active: false,
            };
          }
        }
        return {
          id: 1,
          supplier_id: 10,
          status: 'confirmed',
        };
      }),
      create: jest.fn(),
      save: jest.fn(),
    };
    // First findOne in transaction is order; second is driver link
    let call = 0;
    manager.findOne = jest.fn(async (_entity: any, opts: any) => {
      call += 1;
      if (opts?.where?.role === 'driver') {
        return {
          employee_id: 8,
          supplier_id: 10,
          role: 'driver',
          is_active: false,
        };
      }
      return { id: 1, supplier_id: 10, status: 'confirmed' };
    });
    svc.connection = {
      transaction: jest.fn(async (fn: any) => fn(manager)),
    };

    await expect(
      svc.createDriverAssignment(
        1,
        {
          driver_id: 8,
          scheduled_at: '2026-09-08T10:00:00Z',
          delivery_priority: 1,
        },
        99,
        { userId: 1, company_id: 50 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
