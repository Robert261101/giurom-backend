/**
 * Jest: npx jest --testPathPattern=manual-supplier-create.service
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

function buildService() {
  const supplierRepo = {
    findOne: jest.fn(async () => null),
    create: jest.fn((x: any) => ({ id: 100, ...x })),
    save: jest.fn(async (x: any) => ({ id: 100, ...x })),
  };
  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).supplierRepo = supplierRepo;
  (service as any).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  (service as any).ensureConnectionCodeForAccountSupplier = jest.fn(
    async (s) => s,
  );
  (service as any).createSupplierFolders = jest.fn(async () => undefined);
  (service as any).createSupplierFoldersWithCustomName = jest.fn(
    async () => undefined,
  );
  (service as any).sendSupplierNotification = jest.fn(async () => undefined);
  (service as any).assertLocationBelongsToRequesterCompany = jest.fn(
    async () => undefined,
  );
  (service as any).fetchCompanyLocationIds = jest.fn(async () => [1, 2, 3]);
  (service as any).seedSupplierLocationsForCompany = jest.fn(async () => ({
    attached: 3,
  }));
  (service as any).assignSupplierToLocation = jest.fn(async () => ({}));
  const manualStateRepo = {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => x),
  };
  (service as any).connection = {
    getRepository: jest.fn(() => manualStateRepo),
  };
  (service as any).supplierQuotaService = {
    withCompanySupplierQuotaLock: jest.fn(async (_id: number, fn: () => Promise<unknown>) =>
      fn(),
    ),
    assertCanCreateManualSupplier: jest.fn(async () => ({
      plan_code: 'gold',
      limits: {},
    })),
  };

  return { service, supplierRepo, manualStateRepo };
}

const dto = {
  supplier_name: 'Manual Co',
  registration_number: 'RO1',
  vat_number: 'RO1',
  email: 'a@b.c',
  phone: '0700',
  contact_person: 'X',
} as any;

const requester = {
  company_id: 15,
  company_type: 'client',
  roles: ['client'],
  permissions: ['suppliers.write'],
  userId: 1,
};

describe('Manual supplier create company-wide', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('create seeds all company locations (3)', async () => {
    const { service, supplierRepo } = buildService();
    await service.create(dto, 1, requester);
    expect(supplierRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner_company_id: null }),
    );
    expect((service as any).seedSupplierLocationsForCompany).toHaveBeenCalledWith(
      100,
      15,
    );
    expect((service as any).assignSupplierToLocation).not.toHaveBeenCalled();
  });

  it('create with 1 location seeds once via helper', async () => {
    const { service } = buildService();
    (service as any).fetchCompanyLocationIds = jest.fn(async () => [7]);
    await service.create(dto, undefined, requester);
    expect((service as any).seedSupplierLocationsForCompany).toHaveBeenCalledWith(
      100,
      15,
    );
  });

  it('create with 0 locations returns 400 and does not save', async () => {
    const { service, supplierRepo } = buildService();
    (service as any).fetchCompanyLocationIds = jest.fn(async () => []);
    await expect(service.create(dto, undefined, requester)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(supplierRepo.save).not.toHaveBeenCalled();
    expect((service as any).seedSupplierLocationsForCompany).not.toHaveBeenCalled();
  });

  it('createWithDocuments uses same company-wide seed', async () => {
    const { service } = buildService();
    await service.createWithDocuments(
      { ...dto, folderName: 'f', documents: [] },
      2,
      requester,
    );
    expect((service as any).seedSupplierLocationsForCompany).toHaveBeenCalledWith(
      100,
      15,
    );
  });

  it('createWithDocuments 0 locations → 400', async () => {
    const { service, supplierRepo } = buildService();
    (service as any).fetchCompanyLocationIds = jest.fn(async () => []);
    await expect(
      service.createWithDocuments(
        { ...dto, folderName: 'f', documents: [] },
        undefined,
        requester,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(supplierRepo.save).not.toHaveBeenCalled();
  });

  it('client create ignores dto.is_active on supplier master and seeds per-client state', async () => {
    const { service, supplierRepo, manualStateRepo } = buildService();
    await service.create({ ...dto, is_active: false }, 1, requester);
    expect(supplierRepo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_active: false }),
    );
    expect(supplierRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner_company_id: null }),
    );
    expect(manualStateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        client_company_id: 15,
        supplier_id: 100,
        quota_status: 'active',
        is_active: false,
      }),
    );
  });
});
