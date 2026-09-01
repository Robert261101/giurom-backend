/**
 * Jest: npm test -- src/employee-location-tenant.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { EmployeeService } from './employee.service';

function buildEmployeeServiceForTenantTest() {
  const employeeRepository = {
    findOne: jest.fn(async (opts: any) => {
      const id = Number(opts?.where?.id);
      if (id === 1) {
        return { id: 1, work_location_default_id: 10 };
      }
      if (id === 2) {
        return { id: 2, work_location_default_id: 20 };
      }
      if (id === 3) {
        return { id: 3, work_location_default_id: null };
      }
      return null;
    }),
  };
  const employeeLocationRepository = {
    find: jest.fn(async (opts: any) => {
      if (Number(opts?.where?.employeeId) === 3) {
        return [{ idLocation: 10 }];
      }
      return [];
    }),
  };

  const service = Object.create(EmployeeService.prototype) as EmployeeService;
  (service as any).employeeRepository = employeeRepository;
  (service as any).employeeLocationRepository = employeeLocationRepository;
  (service as any).getLocationCompanyId = jest.fn(async (locationId: number) => {
    if (locationId === 10) return 1;
    if (locationId === 20) return 2;
    return null;
  });

  return { service, employeeRepository };
}

const userA = {
  sub: 99,
  company_id: 1,
  permissions: ['employees.read'],
};

describe('EmployeeService VAL 4 tenant isolation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('allows employee A for company A', async () => {
    const { service } = buildEmployeeServiceForTenantTest();
    await expect(service.assertCanAccessEmployee(1, userA)).resolves.toBeUndefined();
  });

  it('denies employee B for company A', async () => {
    const { service } = buildEmployeeServiceForTenantTest();
    await expect(service.assertCanAccessEmployee(2, userA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows employee with junction location in company A', async () => {
    const { service } = buildEmployeeServiceForTenantTest();
    await expect(service.assertCanAccessEmployee(3, userA)).resolves.toBeUndefined();
  });
});
