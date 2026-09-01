/**
 * Jest: npm test -- src/val4-employee-files-tenant.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { EmployeeService } from './employee.service';

function buildEmployeeFileTenantService() {
  const employeeRepository = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 1) return { id: 1, work_location_default_id: 10 };
      if (id === 2) return { id: 2, work_location_default_id: 20 };
      return null;
    }),
  };
  const filesRepository = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 100) return { id: 100, employee_id: 1, file_name: 'a.pdf' };
      if (id === 200) return { id: 200, employee_id: 2, file_name: 'b.pdf' };
      return null;
    }),
  };
  const employeeLocationRepository = {
    find: jest.fn(async () => []),
  };

  const service = Object.create(EmployeeService.prototype) as EmployeeService;
  (service as any).employeeRepository = employeeRepository;
  (service as any).filesRepository = filesRepository;
  (service as any).employeeLocationRepository = employeeLocationRepository;
  (service as any).getLocationCompanyId = jest.fn(async (locationId: number) => {
    if (locationId === 10) return 1;
    if (locationId === 20) return 2;
    return null;
  });
  (service as any).findOneFile = EmployeeService.prototype['findOneFile'].bind(
    service,
  );

  return { service };
}

const adminA = { sub: 50, company_id: 1, permissions: ['employees.read'] };
const selfA = { sub: 1, company_id: 1, permissions: ['employees.read_own'] };

describe('EmployeeService VAL 4 file/folder tenant isolation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('admin A can access employee A file', async () => {
    const { service } = buildEmployeeFileTenantService();
    await expect(
      (service as any).assertEmployeeFileTenantAccess(100, adminA),
    ).resolves.toMatchObject({ employee_id: 1 });
  });

  it('admin A cannot access employee B file', async () => {
    const { service } = buildEmployeeFileTenantService();
    await expect(
      (service as any).assertEmployeeFileTenantAccess(200, adminA),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('operational self can access own file', async () => {
    const { service } = buildEmployeeFileTenantService();
    await expect(
      (service as any).assertEmployeeFileTenantAccess(100, selfA),
    ).resolves.toMatchObject({ employee_id: 1 });
  });

  it('operational self cannot access another employee file', async () => {
    const { service } = buildEmployeeFileTenantService();
    await expect(
      (service as any).assertEmployeeFileTenantAccess(200, selfA),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
