/**
 * Jest: npx jest --testPathPattern=supplier-company-wide.service
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

function buildService(overrides: Record<string, any> = {}) {
  const supplierLocationsRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    createQueryBuilder: jest.fn(),
    ...(overrides.supplierLocationsRepo || {}),
  };
  const clientSupplierLinkRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(),
    ...(overrides.clientSupplierLinkRepo || {}),
  };

  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).supplierLocationsRepo = supplierLocationsRepo;
  (service as any).clientSupplierLinkRepo = clientSupplierLinkRepo;
  (service as any).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  (service as any).fetchCompanyLocationIds = jest.fn(async () => [10, 20, 30]);
  (service as any).assignSupplierToLocation = jest.fn(async () => ({}));
  (service as any).fetchLocation = jest.fn(async () => ({
    id: 99,
    company_id: 15,
  }));

  return { service, supplierLocationsRepo, clientSupplierLinkRepo };
}

describe('company-wide supplier locations', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('seedSupplierLocationsForCompany attaches all missing locations', async () => {
    const { service, supplierLocationsRepo } = buildService();
    supplierLocationsRepo.find.mockResolvedValue([{ id_location: 20 }]);

    const result = await service.seedSupplierLocationsForCompany(5, 15);
    expect(result.location_ids).toEqual([10, 20, 30]);
    expect(result.attached).toBe(2);
    expect(result.already_present).toBe(1);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledTimes(2);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(5, 10);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(5, 30);
  });

  it('seedSupplierLocationsForCompany rerun is idempotent (0 attach)', async () => {
    const { service, supplierLocationsRepo } = buildService();
    supplierLocationsRepo.find.mockResolvedValue([
      { id_location: 10 },
      { id_location: 20 },
      { id_location: 30 },
    ]);
    const result = await service.seedSupplierLocationsForCompany(5, 15);
    expect(result.attached).toBe(0);
    expect((service as any).assignSupplierToLocation).not.toHaveBeenCalled();
  });

  it('seedSupplierLocationsForCompany rejects invalid ids', async () => {
    const { service } = buildService();
    await expect(service.seedSupplierLocationsForCompany(0, 15)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('attachCompanySuppliersToLocation validates location company', async () => {
    const { service } = buildService();
    (service as any).fetchLocation = jest.fn(async () => ({
      id: 99,
      company_id: 1,
    }));
    await expect(
      service.attachCompanySuppliersToLocation(15, 99),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('attachCompanySuppliersToLocation attaches Manual + Cont only for company', async () => {
    const { service, supplierLocationsRepo, clientSupplierLinkRepo } =
      buildService();
    (service as any).fetchLocation = jest.fn(async () => ({
      id: 40,
      company_id: 15,
    }));
    (service as any).fetchCompanyLocationIds = jest.fn(async () => [15, 40]);

    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => [{ supplier_id: 19 }]),
    };
    supplierLocationsRepo.createQueryBuilder.mockReturnValue(qb);
    clientSupplierLinkRepo.find.mockResolvedValue([{ supplier_id: 10 }]);
    supplierLocationsRepo.findOne.mockResolvedValue(null);

    const result = await service.attachCompanySuppliersToLocation(15, 40);
    expect(result.manual_supplier_ids).toEqual([19]);
    expect(result.account_supplier_ids).toEqual([10]);
    expect(result.inserted).toBe(2);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(19, 40);
    expect((service as any).assignSupplierToLocation).toHaveBeenCalledWith(10, 40);
  });

  it('attachCompanySuppliersToLocation 404 when location missing', async () => {
    const { service } = buildService();
    (service as any).fetchLocation = jest.fn(async () => null);
    await expect(
      service.attachCompanySuppliersToLocation(15, 999),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
