/**
 * Jest: npm test -- src/suppliers/client-supplier-connect.service.test.ts
 *
 * Exercises SuppliersService connect/regenerate/ensure helpers with mocked repos.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { generateSupplierConnectionCode } from './connection-code.util';

function buildService(overrides: Record<string, any> = {}) {
  const supplierRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    ...(overrides.supplierRepo || {}),
  };
  const clientSupplierLinkRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 1, ...x })),
    ...(overrides.clientSupplierLinkRepo || {}),
  };
  const supplierLocationsRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    ...(overrides.supplierLocationsRepo || {}),
  };

  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).supplierRepo = supplierRepo;
  (service as any).clientSupplierLinkRepo = clientSupplierLinkRepo;
  (service as any).supplierLocationsRepo = supplierLocationsRepo;
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  (service as any).fetchCompanyLocationIds = jest.fn(async () => [101, 102]);
  (service as any).assignSupplierToLocation = jest.fn(async () => ({}));
  (service as any).supplierQuotaService = {
    withCompanySupplierQuotaLock: jest.fn(async (_id: number, fn: () => Promise<unknown>) =>
      fn(),
    ),
    assertCanConnectAccountSupplier: jest.fn(async () => ({
      plan_code: 'gold',
      limits: {},
    })),
  };
  (service as any).supplierPlanQuotaService = {
    withFurnizorQuotaLock: jest.fn(async (_id: number, fn: () => Promise<unknown>) =>
      fn(),
    ),
    assertFurnizorCanAcceptClient: jest.fn(async () => undefined),
    assertFurnizorCanAssignStaff: jest.fn(async () => undefined),
    getOwnerCompanyIdForSupplier: jest.fn(async () => 50),
    ...(overrides.supplierPlanQuotaService || {}),
  };
  (service as any).supplierQuotaLifecycleService = {
    resolveAccountQuotaStatus: jest.fn((link: any) =>
      String(link?.quota_status || 'active').toLowerCase(),
    ),
    reactivateAccountLink: jest.fn(async () => ({})),
  };
  (service as any).connectionCodeAttemptService = {
    withCompanyAttemptLock: jest.fn(async (_id: number, fn: () => Promise<unknown>) =>
      fn(),
    ),
    assertNotLocked: jest.fn(async () => ({})),
    recordInvalidAttempt: jest.fn(async () => {
      throw new NotFoundException('Cod invalid');
    }),
    resetAttempts: jest.fn(async () => {}),
    getStatus: jest.fn(async () => ({
      failed_count: 0,
      attempts_remaining: 5,
      locked: false,
      locked_until: null,
      seconds_remaining: 0,
      max_attempts: 5,
    })),
    ...(overrides.connectionCodeAttemptService || {}),
  };
  (service as any).hasSupplierLoginAccount = jest.fn(async () => true);
  (service as any).findMySupplierForFurnizorTenant = jest.fn(async () => ({
    id: 7,
    supplier_name: 'Acme Furnizor',
  }));

  return { service, supplierRepo, clientSupplierLinkRepo };
}

describe('SuppliersService connection code + connect', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('ensureConnectionCodeForAccountSupplier assigns code when owner_company_id set', async () => {
    const { service, supplierRepo } = buildService();
    const supplier: any = { id: 7, owner_company_id: 50, connection_code: null };
    supplierRepo.update.mockResolvedValue({ affected: 1 });
    supplierRepo.findOne.mockResolvedValue({
      ...supplier,
      connection_code: 'ABCDEFGHJKLM',
    });

    const result = await service.ensureConnectionCodeForAccountSupplier(supplier);
    expect(result.connection_code).toBe('ABCDEFGHJKLM');
    expect(supplierRepo.update).toHaveBeenCalled();
  });

  it('ensureConnectionCodeForAccountSupplier skips Manual (no owner_company_id)', async () => {
    const { service, supplierRepo } = buildService();
    const supplier: any = { id: 8, owner_company_id: null, connection_code: null };
    const result = await service.ensureConnectionCodeForAccountSupplier(supplier);
    expect(result.connection_code).toBeNull();
    expect(supplierRepo.update).not.toHaveBeenCalled();
  });

  it('getMySupplierConnectionCode returns code for furnizor tenant', async () => {
    const { service, supplierRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 7,
      owner_company_id: 50,
      connection_code: 'ABCDEFGHJKLM',
    });
    const result = await service.getMySupplierConnectionCode(50, 'furnizor', [
      'furnizor',
    ]);
    expect(result).toEqual({
      supplier_id: 7,
      connection_code: 'ABCDEFGHJKLM',
    });
  });

  it('regenerateMySupplierConnectionCode changes code and keeps links untouched', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 7,
      owner_company_id: 50,
      connection_code: 'OLDCODEOLDCOD',
    });
    supplierRepo.update.mockResolvedValue({ affected: 1 });

    const result = await service.regenerateMySupplierConnectionCode(50, 'furnizor', [
      'furnizor',
    ]);
    expect(result.supplier_id).toBe(7);
    expect(result.connection_code).toHaveLength(12);
    expect(result.connection_code).not.toBe('OLDCODEOLDCOD');
    expect(clientSupplierLinkRepo.save).not.toHaveBeenCalled();
    expect(clientSupplierLinkRepo.findOne).not.toHaveBeenCalled();
  });

  it('connectSupplierByCode creates link and seeds locations', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    const code = generateSupplierConnectionCode(() =>
      Uint8Array.from({ length: 32 }, () => 3),
    );
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'Linked Co',
      owner_company_id: 99,
      is_active: true,
      connection_code: code,
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);

    const result = await service.connectSupplierByCode(code, {
      company_id: 5,
      company_type: 'client',
      roles: ['client'],
      permissions: ['suppliers.read'],
      userId: 33,
    });

    expect(result.supplier_id).toBe(10);
    expect(result.already_linked).toBe(false);
    expect(clientSupplierLinkRepo.save).toHaveBeenCalled();
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(10, 101);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(10, 102);
  });

  it('connect enforces clients.max on the FURNIZOR owner company (freeze-create)', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService({
      supplierPlanQuotaService: {
        assertFurnizorCanAcceptClient: jest.fn(async () => {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'SUBSCRIPTION_LIMIT_REACHED',
            code: 'SUPPLIER_CLIENTS_LIMIT_REACHED',
            details: { limit_key: 'clients.max', used: 3, limit: 3 },
          });
        }),
      },
    });
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'Full Co',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);

    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((service as any).supplierPlanQuotaService.assertFurnizorCanAcceptClient).toHaveBeenCalledWith(99);
    expect((service as any).supplierPlanQuotaService.withFurnizorQuotaLock).toHaveBeenCalledWith(99, expect.any(Function));
    expect(clientSupplierLinkRepo.save).not.toHaveBeenCalled();
    expect((service as any).assignSupplierToLocation).not.toHaveBeenCalled();
  });

  it('connect reactivation of a removed link also consumes a furnizor client slot', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'Back Co',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue({ id: 1, quota_status: 'removed' });

    const result = await service.connectSupplierByCode('ABCDEFGHJKLM', {
      company_id: 5,
      company_type: 'client',
      permissions: ['suppliers.read'],
    });
    expect(result.supplier_id).toBe(10);
    expect((service as any).supplierPlanQuotaService.assertFurnizorCanAcceptClient).toHaveBeenCalledWith(99);
    expect((service as any).supplierQuotaLifecycleService.reactivateAccountLink).toHaveBeenCalled();
    expect((service as any).supplierQuotaService.assertCanConnectAccountSupplier).not.toHaveBeenCalled();
  });

  it('connect rejects invalid code with 404', async () => {
    const { service, supplierRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue(null);
    await expect(
      service.connectSupplierByCode('NOPE', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('connect rejects inactive supplier with 404', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      owner_company_id: 99,
      is_active: false,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('connect rejects already linked with 409', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue({ id: 1 });
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('connect rejects self-link with 400', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      owner_company_id: 5,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('connect rejects furnizor tenant with 403', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'furnizor',
        roles: ['furnizor'],
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('connect rejects supplier without real furnizor login', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'No Login Co',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    (service as any).hasSupplierLoginAccount = jest.fn(async () => false);

    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(clientSupplierLinkRepo.save).not.toHaveBeenCalled();
  });

  it('connect maps duplicate unique constraint to 409', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'X',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    clientSupplierLinkRepo.save.mockRejectedValue({
      message: 'ER_DUP_ENTRY UQ_client_supplier_links_client_supplier',
    });
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('old code after regenerate no longer finds supplier (regression for connect)', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    supplierRepo.findOne
      .mockResolvedValueOnce({
        id: 7,
        owner_company_id: 50,
        connection_code: 'OLDCODEOLDCOD',
      })
      .mockResolvedValueOnce(null);
    supplierRepo.update.mockResolvedValue({ affected: 1 });

    const regenerated = await service.regenerateMySupplierConnectionCode(
      50,
      'furnizor',
      ['furnizor'],
    );
    expect(regenerated.connection_code).not.toBe('OLDCODEOLDCOD');

    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    await expect(
      service.connectSupplierByCode('OLDCODEOLDCOD', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('valid connect resets failed attempts', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    const attempts = (service as any).connectionCodeAttemptService;
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'Linked Co',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    await service.connectSupplierByCode('ABCDEFGHJKLM', {
      company_id: 5,
      company_type: 'client',
      permissions: ['suppliers.read'],
      userId: 3,
    });
    expect(attempts.resetAttempts).toHaveBeenCalledWith(5, 3);
    expect(attempts.recordInvalidAttempt).not.toHaveBeenCalled();
  });

  it('already-linked does not consume invalid attempts', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    const attempts = (service as any).connectionCodeAttemptService;
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue({
      id: 1,
      quota_status: 'active',
    });
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
        userId: 8,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(attempts.recordInvalidAttempt).not.toHaveBeenCalled();
    expect(attempts.resetAttempts).toHaveBeenCalledWith(5, 8);
  });

  it('quota exceeded after valid code does not consume attempts', async () => {
    const { service, supplierRepo, clientSupplierLinkRepo } = buildService();
    const attempts = (service as any).connectionCodeAttemptService;
    supplierRepo.findOne.mockResolvedValue({
      id: 10,
      supplier_name: 'X',
      owner_company_id: 99,
      is_active: true,
      connection_code: 'ABCDEFGHJKLM',
    });
    clientSupplierLinkRepo.findOne.mockResolvedValue(null);
    (service as any).supplierQuotaService.assertCanConnectAccountSupplier =
      jest.fn(async () => {
        throw new ForbiddenException({
          code: 'SUPPLIER_ACCOUNT_LIMIT_REACHED',
          message: 'limit',
        });
      });
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
        userId: 2,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(attempts.resetAttempts).toHaveBeenCalledWith(5, 2);
    expect(attempts.recordInvalidAttempt).not.toHaveBeenCalled();
  });

  it('while locked does not look up supplier code', async () => {
    const { service, supplierRepo } = buildService({
      connectionCodeAttemptService: {
        withCompanyAttemptLock: jest.fn(
          async (_id: number, fn: () => Promise<unknown>) => fn(),
        ),
        assertNotLocked: jest.fn(async () => {
          throw new HttpException(
            { code: 'SUPPLIER_CONNECTION_CODE_LOCKED' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }),
        recordInvalidAttempt: jest.fn(),
        resetAttempts: jest.fn(),
        getStatus: jest.fn(),
      },
    });
    await expect(
      service.connectSupplierByCode('ABCDEFGHJKLM', {
        company_id: 5,
        company_type: 'client',
        permissions: ['suppliers.read'],
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(supplierRepo.findOne).not.toHaveBeenCalled();
  });
});
