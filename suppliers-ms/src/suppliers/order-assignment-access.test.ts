/**
 * Jest: npm test -- src/suppliers/order-assignment-access.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import {
  assertDriverSelfOrOperationalAdmin,
  assertOperationalEmployeeDashboardAccess,
  canManageCompanyOperationalEmployees,
} from './order-assignment-access';

const storekeeperA = { sub: 100, company_id: 1, permissions: ['order.read'] };
const storekeeperB = { sub: 200, company_id: 1, permissions: ['order.read'] };
const clientAdmin = {
  sub: 50,
  company_id: 1,
  permissions: ['order.read', 'employees.read'],
  isAdmin: true,
};
const platformAdmin = {
  permissions: ['assignment.read_all'],
};
const boundReadAll = {
  company_id: 1,
  permissions: ['assignment.read_all'],
};

describe('order-assignment-access', () => {
  describe('assertOperationalEmployeeDashboardAccess', () => {
    it('storekeeper A can access own dashboard', () => {
      expect(() =>
        assertOperationalEmployeeDashboardAccess(storekeeperA, 100),
      ).not.toThrow();
    });

    it('storekeeper A cannot access storekeeper B via URL employeeId', () => {
      expect(() =>
        assertOperationalEmployeeDashboardAccess(storekeeperA, 200),
      ).toThrow(ForbiddenException);
    });

    it('client admin can access another employee in company (after async company check)', () => {
      expect(() =>
        assertOperationalEmployeeDashboardAccess(clientAdmin, 200),
      ).not.toThrow();
    });

    it('platform admin can access any employeeId', () => {
      expect(() =>
        assertOperationalEmployeeDashboardAccess(platformAdmin, 999),
      ).not.toThrow();
    });

    it('bound assignment.read_all is treated as tenant manager (company check async)', () => {
      expect(canManageCompanyOperationalEmployees(boundReadAll)).toBe(true);
    });
  });

  describe('assertDriverSelfOrOperationalAdmin', () => {
    it('driver self can complete own assignment', () => {
      expect(() =>
        assertDriverSelfOrOperationalAdmin(storekeeperA, 100),
      ).not.toThrow();
    });

    it('driver cannot complete another driver assignment', () => {
      expect(() =>
        assertDriverSelfOrOperationalAdmin(storekeeperA, 200),
      ).toThrow(ForbiddenException);
    });

    it('client admin can complete on behalf of driver', () => {
      expect(() =>
        assertDriverSelfOrOperationalAdmin(clientAdmin, 200),
      ).not.toThrow();
    });
  });
});
