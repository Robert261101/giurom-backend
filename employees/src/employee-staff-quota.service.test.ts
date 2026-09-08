/**
 * Rulare: npm test -- src/employee-staff-quota.service.test.ts
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import {
  EmployeeStaffQuotaService,
  staffRoleForPosition,
  staffRoleRequiringAssertOnUpdate,
} from './employee-staff-quota.service';

describe('staffRoleForPosition', () => {
  it('maps 5 → warehouse, 4 → driver, others → null', () => {
    expect(staffRoleForPosition(5)).toBe('warehouse');
    expect(staffRoleForPosition(4)).toBe('driver');
    expect(staffRoleForPosition(1)).toBeNull();
    expect(staffRoleForPosition(null)).toBeNull();
    expect(staffRoleForPosition(undefined)).toBeNull();
  });
});

describe('staffRoleRequiringAssertOnUpdate', () => {
  it('asserts only when the implied role changes to an operational one', () => {
    expect(staffRoleRequiringAssertOnUpdate(null, 5)).toBe('warehouse');
    expect(staffRoleRequiringAssertOnUpdate(1, 4)).toBe('driver');
    expect(staffRoleRequiringAssertOnUpdate(5, 4)).toBe('driver'); // role change: new slot in driver
    expect(staffRoleRequiringAssertOnUpdate(5, 5)).toBeNull(); // same role: no new slot
    expect(staffRoleRequiringAssertOnUpdate(5, 1)).toBeNull(); // leaving ops role: frees, never asserts
    expect(staffRoleRequiringAssertOnUpdate(5, undefined)).toBeNull(); // position not in payload
  });
});

describe('EmployeeStaffQuotaService', () => {
  const svc = new EmployeeStaffQuotaService();
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.PLAN_GATING_MODE;
  });

  it('resolveCompanyId prefers JWT company, then location company, else null', () => {
    expect(svc.resolveCompanyId({ company_id: 9 }, 3)).toBe(9);
    expect(svc.resolveCompanyId({ bypassAuth: true }, 3)).toBe(3);
    expect(svc.resolveCompanyId({}, null)).toBeNull();
  });

  it('fail-closed: unknown company → 403 PLAN_COMPANY_UNRESOLVED (no Free fallback)', async () => {
    await expect(svc.assertStaffQuota(null, 'warehouse', 1)).rejects.toMatchObject({
      response: { error: 'PLAN_COMPANY_UNRESOLVED' },
    });
  });

  it('calls suppliers-ms internal assert with role and employee_id', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);
    await svc.assertStaffQuota(9, 'driver', 12);
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/suppliers/internal/companies/9/staff-quota/assert'),
      { role: 'driver', employee_id: 12 },
      expect.objectContaining({ headers: expect.objectContaining({ 'x-internal-service': 'employees' }) }),
    );
  });

  it('propagates 403 quota body from suppliers-ms', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue({
      response: { status: 403, data: { statusCode: 403, code: 'STAFF_DRIVER_LIMIT_REACHED', error: 'SUBSCRIPTION_LIMIT_REACHED' } },
    });
    try {
      await svc.assertStaffQuota(9, 'driver', 12);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'STAFF_DRIVER_LIMIT_REACHED' });
    }
  });

  it('fail-closed: suppliers-ms unreachable → 503', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(svc.assertStaffQuota(9, 'warehouse', 12)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('PLAN_GATING_MODE=off skips; log allows', async () => {
    process.env.PLAN_GATING_MODE = 'off';
    const post = jest.spyOn(axios, 'post');
    await expect(svc.assertStaffQuota(null, 'warehouse', 1)).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
    process.env.PLAN_GATING_MODE = 'log';
    post.mockRejectedValue(new Error('down'));
    await expect(svc.assertStaffQuota(9, 'warehouse', 1)).resolves.toBeUndefined();
  });

  it('removeStaffLinks is best-effort', async () => {
    jest.spyOn(axios, 'delete').mockRejectedValue(new Error('down'));
    await expect(svc.removeStaffLinks(12)).resolves.toBeUndefined();
  });

  it('syncStaffRole removes links when role is null', async () => {
    const del = jest.spyOn(axios, 'delete').mockResolvedValue({ data: { removed: 1 } } as any);
    await svc.syncStaffRole(9, 12, null);
    expect(del).toHaveBeenCalledWith(
      expect.stringContaining('/suppliers/internal/employees/12/staff-links'),
      expect.any(Object),
    );
  });

  it('syncStaffRole upserts warehouse/driver link via internal staff-links', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);
    await svc.syncStaffRole(9, 12, 'warehouse');
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/suppliers/internal/companies/9/staff-links'),
      { employee_id: 12, role: 'warehouse' },
      expect.any(Object),
    );
  });
});
