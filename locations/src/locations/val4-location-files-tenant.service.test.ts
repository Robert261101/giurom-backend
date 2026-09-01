/**
 * Jest: npm test -- src/locations/val4-location-files-tenant.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { LocationsService } from './locations.service';

function buildLocationsFileTenantService() {
  const workLocationRepository = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 10) return { id: 10, company_id: 1, location_name: 'Loc A' };
      if (id === 20) return { id: 20, company_id: 2, location_name: 'Loc B' };
      return null;
    }),
  };
  const filesRepository = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 100) return { id: 100, work_location_id: 10, file_name: 'a.pdf' };
      if (id === 200) return { id: 200, work_location_id: 20, file_name: 'b.pdf' };
      return null;
    }),
  };

  const service = Object.create(LocationsService.prototype) as LocationsService;
  (service as any).workLocationRepository = workLocationRepository;
  (service as any).filesRepository = filesRepository;
  (service as any).findOneFile = LocationsService.prototype['findOneFile'].bind(
    service,
  );

  return { service };
}

const tenantA = { company_id: 1, permissions: ['locations.read'] };

describe('LocationsService VAL 4 file tenant isolation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('allows tenant A to access file on location in company A', async () => {
    const { service } = buildLocationsFileTenantService();
    await expect(
      (service as any).assertLocationFileTenantAccess(100, tenantA),
    ).resolves.toMatchObject({ id: 100, work_location_id: 10 });
  });

  it('denies tenant A access to file on location in company B', async () => {
    const { service } = buildLocationsFileTenantService();
    await expect(
      (service as any).assertLocationFileTenantAccess(200, tenantA),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
