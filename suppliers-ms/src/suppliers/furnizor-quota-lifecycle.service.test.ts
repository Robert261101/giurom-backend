/**
 * Jest: npm test -- src/suppliers/furnizor-quota-lifecycle.service.test.ts
 */
import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { FurnizorQuotaLifecycleService } from './furnizor-quota-lifecycle.service';

function build() {
  const clientSupplierLinkRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (row: any) => row),
  };
  const employeeSupplierRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (row: any) => row),
  };
  const planQuota = {
    getSupplierIdsForOwnerCompany: jest.fn(async () => [10]),
    withFurnizorQuotaLock: jest.fn(async (_id: number, fn: () => Promise<any>) => fn()),
    countDistinctClientsForOwnerCompany: jest.fn(async () => 0),
    assertFurnizorCanAssignStaff: jest.fn(async () => undefined),
  };
  const planAccess = {
    assertLimitForCompany: jest.fn(async () => undefined),
  };
  const svc = new FurnizorQuotaLifecycleService(
    clientSupplierLinkRepo as any,
    employeeSupplierRepo as any,
    planQuota as any,
    planAccess as any,
  );
  return { svc, clientSupplierLinkRepo, employeeSupplierRepo, planQuota };
}

describe('FurnizorQuotaLifecycleService.buildDowngradePreview', () => {
  it('computes minima per bucket and requires_blocks when any surplus', () => {
    const { svc } = build();
    const preview = svc.buildDowngradePreview(
      'free',
      3,
      1,
      1,
      [
        { id: 1, name: 'C1' },
        { id: 2, name: 'C2' },
        { id: 3, name: 'C3' },
        { id: 4, name: 'C4' },
      ],
      [
        { id: 11, name: 'W1' },
        { id: 12, name: 'W2' },
      ],
      [{ id: 21, name: 'D1' }],
      { limit: 1, used: 2, minimum_to_block: 1, items: [{ id: 31, name: 'L1' }, { id: 32, name: 'L2' }] },
    );
    expect(preview.requires_blocks).toBe(true);
    expect(preview.clients.minimum_to_block).toBe(1);
    expect(preview.staff_warehouse.minimum_to_block).toBe(1);
    expect(preview.staff_driver.minimum_to_block).toBe(0);
    expect(preview.locations?.minimum_to_block).toBe(1);
  });

  it('validateDowngradeBlockSelection rejects insufficient client blocks', () => {
    const { svc } = build();
    const preview = svc.buildDowngradePreview(
      'free',
      1,
      10,
      10,
      [
        { id: 1, name: 'C1' },
        { id: 2, name: 'C2' },
        { id: 3, name: 'C3' },
      ],
      [],
      [],
    );
    expect(() =>
      svc.validateDowngradeBlockSelection(preview, [1], [], []),
    ).toThrow(BadRequestException);
  });

  it('validateDowngradeBlockSelection accepts enough blocks', () => {
    const { svc } = build();
    const preview = svc.buildDowngradePreview(
      'free',
      1,
      10,
      10,
      [
        { id: 1, name: 'C1' },
        { id: 2, name: 'C2' },
        { id: 3, name: 'C3' },
      ],
      [],
      [],
    );
    expect(() =>
      svc.validateDowngradeBlockSelection(preview, [1, 2], [], []),
    ).not.toThrow();
  });
});
