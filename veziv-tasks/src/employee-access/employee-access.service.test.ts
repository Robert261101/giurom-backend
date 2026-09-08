/**
 * Soft-block vs reactivate staff membership for employee-points access.
 * Run from veziv-tasks: npx jest src/employee-access/employee-access.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { EmployeeAccessService } from './employee-access.service';

function buildService(staffIdsByEndpoint: {
  drivers?: number[];
  warehouse?: number[];
}) {
  const httpService = {
    get: jest.fn((url: string) => {
      if (url.includes('/suppliers/my-supplier')) {
        return of({ data: { id: 10 } });
      }
      if (url.includes('/drivers')) {
        return of({
          data: (staffIdsByEndpoint.drivers ?? []).map((employee_id) => ({
            employee_id,
          })),
        });
      }
      if (url.includes('/warehouse')) {
        return of({
          data: (staffIdsByEndpoint.warehouse ?? []).map((employee_id) => ({
            employee_id,
          })),
        });
      }
      return of({ data: {} });
    }),
  };
  return new EmployeeAccessService(httpService as any);
}

const furnizorAdmin = {
  sub: 1,
  permissions: ['suppliers.create'],
  roles: ['furnizor'],
  company_type: 'furnizor',
  company_id: 50,
};

describe('EmployeeAccessService staff soft-block / reactivate', () => {
  let svc: EmployeeAccessService;

  beforeEach(() => {
    svc = buildService({ drivers: [], warehouse: [] });
  });

  it('furnizor admin: soft-blocked staff (absent from active lists) → 403', async () => {
    svc = buildService({ drivers: [4], warehouse: [5] });
    await expect(
      svc.assertCanReadEmployeeData(furnizorAdmin, 12, 'Bearer test'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('furnizor admin: after reactivate (present in active warehouse) → allow', async () => {
    svc = buildService({ drivers: [4], warehouse: [5, 12] });
    await expect(
      svc.assertCanReadEmployeeData(furnizorAdmin, 12, 'Bearer test'),
    ).resolves.toBeUndefined();
  });

  it('other tenant staff id never in list → 403', async () => {
    svc = buildService({ drivers: [3], warehouse: [4] });
    await expect(
      svc.assertCanReadEmployeeData(furnizorAdmin, 99, 'Bearer x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('client-style admin with assignment.read_all bypasses staff list', async () => {
    svc = buildService({ drivers: [], warehouse: [] });
    await expect(
      svc.assertCanReadEmployeeData(
        {
          sub: 1,
          permissions: ['assignment.read_all'],
          roles: ['admin'],
          company_type: 'client',
        },
        12,
        'Bearer x',
      ),
    ).resolves.toBeUndefined();
  });
});
