/**
 * Jest: npm test -- src/suppliers/val4-operational-access.service.test.ts
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import {
  SupplierOrderAssignmentStatus,
} from './entities/supplier-order-assignment.entity';

const storekeeperA = { sub: 100, company_id: 1, permissions: ['order.read'] };
const storekeeperB = { sub: 200, company_id: 1, permissions: ['order.read'] };
const clientAdmin = {
  sub: 50,
  company_id: 1,
  permissions: ['order.read', 'employees.read'],
  isAdmin: true,
};

function buildOperationalAccessService(assignmentEmployeeId: number | null) {
  const orderAssignmentRepo = {
    findOne: jest.fn(async (opts: any) => {
      if (
        assignmentEmployeeId != null &&
        Number(opts?.where?.supplier_order_id) === 1 &&
        Number(opts?.where?.employee_id) === assignmentEmployeeId
      ) {
        return {
          supplier_order_id: 1,
          employee_id: assignmentEmployeeId,
          status: SupplierOrderAssignmentStatus.ASSIGNED,
        };
      }
      return null;
    }),
  };

  const service = Object.create(SuppliersService.prototype) as SuppliersService;
  (service as any).orderAssignmentRepo = orderAssignmentRepo;
  (service as any).assertClientSupplierRelationship = jest.fn(async () => ({}));
  (service as any).findMySupplierForFurnizorTenant = jest.fn(async () => ({
    id: 10,
  }));

  return { service, orderAssignmentRepo };
}

describe('SuppliersService VAL 4 operational access', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertStorekeeperOperationalAccess', () => {
    it('storekeeper A with assignment on order 1 is allowed', async () => {
      const { service } = buildOperationalAccessService(100);
      await expect(
        (service as any).assertStorekeeperOperationalAccess(1, storekeeperA),
      ).resolves.toBeUndefined();
    });

    it('storekeeper B without assignment on order 1 is denied', async () => {
      const { service } = buildOperationalAccessService(100);
      await expect(
        (service as any).assertStorekeeperOperationalAccess(1, storekeeperB),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('client admin bypasses assignment check', async () => {
      const { service } = buildOperationalAccessService(null);
      await expect(
        (service as any).assertStorekeeperOperationalAccess(1, clientAdmin),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertSupplierStaffListAccess', () => {
    it('client without supplier relationship is denied', async () => {
      const { service } = buildOperationalAccessService(null);
      (service as any).assertClientSupplierRelationship = jest.fn(async () => {
        throw new ForbiddenException('Relație inexistentă');
      });
      await expect(
        (service as any).assertSupplierStaffListAccess(99, {
          company_id: 1,
          company_type: 'client',
          permissions: ['order.read'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('furnizor tenant cannot list staff of another supplier', async () => {
      const { service } = buildOperationalAccessService(null);
      (service as any).findMySupplierForFurnizorTenant = jest.fn(async () => ({
        id: 10,
      }));
      await expect(
        (service as any).assertSupplierStaffListAccess(99, {
          company_id: 5,
          company_type: 'furnizor',
          permissions: ['order.read'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
