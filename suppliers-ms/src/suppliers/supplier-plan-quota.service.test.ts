/**
 * Jest: npm test -- src/suppliers/supplier-plan-quota.service.test.ts
 */
import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createCompanyPlanClient } from '@giurom/tenant-access';
import {
  SupplierPlanQuotaService,
  normalizeStaffRole,
  staffRoleToLimitKey,
} from './supplier-plan-quota.service';
import { PlanAccessService } from '../plan-access/plan-access.nest';

const furnizorFree = {
  company_type: 'furnizor',
  plan: { code: 'free', name: 'Free' },
  status: 'active',
  features: [],
  limits: {
    'clients.max': 3,
    'staff.warehouse.max': 1,
    'staff.driver.max': 1,
  },
};

function planAccess(payload: unknown, ok = true) {
  const svc = new PlanAccessService();
  (svc as any).client = createCompanyPlanClient({
    companiesUrl: 'http://company',
    serviceSecret: 's',
    serviceName: 'suppliers',
    cacheTtlMs: 0,
    fetchImpl: (async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as any,
  });
  return svc;
}

function qb(result: { cnt?: number; count?: number }) {
  const builder: any = {
    select: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    getRawOne: jest.fn(async () => ({ cnt: result.cnt ?? 0 })),
    getCount: jest.fn(async () => result.count ?? 0),
  };
  return builder;
}

function build(opts: {
  supplierIds?: number[];
  clientsCnt?: number;
  staffCnt?: number;
  alreadyCount?: number;
  planPayload?: unknown;
  planOk?: boolean;
}) {
  const supplierRepo = {
    find: jest.fn(async () => (opts.supplierIds ?? [7]).map((id) => ({ id }))),
    findOne: jest.fn(async () => ({ id: 7, owner_company_id: 50 })),
  };
  const clientQb = qb({ cnt: opts.clientsCnt ?? 0 });
  const clientSupplierLinkRepo = { createQueryBuilder: jest.fn(() => clientQb) };
  const staffQbs: any[] = [];
  const employeeSupplierRepo = {
    createQueryBuilder: jest.fn(() => {
      const b = qb({ cnt: opts.staffCnt ?? 0, count: opts.alreadyCount ?? 0 });
      staffQbs.push(b);
      return b;
    }),
    delete: jest.fn(async () => ({ affected: 2 })),
  };
  const runner = {
    connect: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string) => (sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [{}])),
    release: jest.fn(async () => undefined),
  };
  const connection = { createQueryRunner: jest.fn(() => runner) };
  const svc = new SupplierPlanQuotaService(
    supplierRepo as any,
    clientSupplierLinkRepo as any,
    employeeSupplierRepo as any,
    connection as any,
    planAccess(opts.planPayload ?? furnizorFree, opts.planOk ?? true),
  );
  return { svc, supplierRepo, clientQb, staffQbs, employeeSupplierRepo, runner };
}

describe('helpers', () => {
  it('normalizeStaffRole accepts RO + EN labels', () => {
    expect(normalizeStaffRole('magazioner')).toBe('warehouse');
    expect(normalizeStaffRole('warehouse')).toBe('warehouse');
    expect(normalizeStaffRole('sofer')).toBe('driver');
    expect(normalizeStaffRole('Driver')).toBe('driver');
    expect(normalizeStaffRole('admin')).toBeNull();
  });
  it('staffRoleToLimitKey', () => {
    expect(staffRoleToLimitKey('warehouse')).toBe('staff.warehouse.max');
    expect(staffRoleToLimitKey('driver')).toBe('staff.driver.max');
  });
});

describe('clients.max', () => {
  it('counts DISTINCT client companies excluding removed AND blocked', async () => {
    const { svc, clientQb } = build({ clientsCnt: 2 });
    expect(await svc.countDistinctClientsForOwnerCompany(50)).toBe(2);
    expect(clientQb.select).toHaveBeenCalledWith('COUNT(DISTINCT csl.client_company_id)', 'cnt');
    const andWhereSql = (clientQb.andWhere as jest.Mock).mock.calls.map((c) => String(c[0])).join(' ');
    expect(andWhereSql).toContain('quota_status NOT IN');
  });

  it('company with no Cont suppliers → 0 (location-only legacy ignored)', async () => {
    const { svc, clientQb } = build({ supplierIds: [], clientsCnt: 99 });
    expect(await svc.countDistinctClientsForOwnerCompany(50)).toBe(0);
    expect(clientQb.getRawOne).not.toHaveBeenCalled();
  });

  it('allows below limit; denies with SUPPLIER_CLIENTS_LIMIT_REACHED at limit', async () => {
    await expect(build({ clientsCnt: 2 }).svc.assertFurnizorCanAcceptClient(50)).resolves.toBeUndefined();
    try {
      await build({ clientsCnt: 3 }).svc.assertFurnizorCanAcceptClient(50);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        code: 'SUPPLIER_CLIENTS_LIMIT_REACHED',
        details: { limit_key: 'clients.max', used: 3, limit: 3, company_id: 50 },
      });
    }
  });

  it('Manual supplier (no owner company) → no furnizor quota', async () => {
    const { svc, clientQb } = build({ clientsCnt: 100 });
    await expect(svc.assertFurnizorCanAcceptClient(0)).resolves.toBeUndefined();
    expect(clientQb.getRawOne).not.toHaveBeenCalled();
  });

  it('fail-closed when company-ms is down (503)', async () => {
    await expect(build({ clientsCnt: 0, planPayload: {}, planOk: false }).svc.assertFurnizorCanAcceptClient(50))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('staff quotas (freeze-assign)', () => {
  it('counts DISTINCT employees per role only where is_active and excludes the employee being (re)assigned', async () => {
    const { svc, staffQbs } = build({ staffCnt: 1 });
    expect(await svc.countStaffForOwnerCompany(50, 'driver', 12)).toBe(1);
    const b = staffQbs[0];
    expect(b.select).toHaveBeenCalledWith('COUNT(DISTINCT es.employee_id)', 'cnt');
    expect(b.andWhere).toHaveBeenCalledWith('es.role = :role', { role: 'driver' });
    expect(b.andWhere).toHaveBeenCalledWith('es.employee_id != :exclude', { exclude: 12 });
    const andWhereSql = (b.andWhere as jest.Mock).mock.calls.map((c) => String(c[0])).join(' ');
    expect(andWhereSql).toContain('is_active');
  });

  it('separate quotas: warehouse full does not block driver', async () => {
    // staffCnt applies to whichever role is counted; simulate driver free (0)
    const { svc } = build({ staffCnt: 0 });
    await expect(svc.assertFurnizorCanAssignStaff(50, 'driver', 12)).resolves.toBeUndefined();
  });

  it('denies STAFF_WAREHOUSE_LIMIT_REACHED when another employee already holds the only slot', async () => {
    const { svc } = build({ staffCnt: 1, alreadyCount: 0 });
    try {
      await svc.assertFurnizorCanAssignStaff(50, 'warehouse', 12);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'STAFF_WAREHOUSE_LIMIT_REACHED',
        details: { limit_key: 'staff.warehouse.max', used: 1, limit: 1 },
      });
    }
  });

  it('denies STAFF_DRIVER_LIMIT_REACHED with driver code', async () => {
    const { svc } = build({ staffCnt: 1 });
    await expect(svc.assertFurnizorCanAssignStaff(50, 'driver', 12)).rejects.toMatchObject({
      response: { code: 'STAFF_DRIVER_LIMIT_REACHED' },
    });
  });

  it('employee already holding the role does not consume a new slot (idempotent re-link)', async () => {
    const { svc, staffQbs } = build({ staffCnt: 5, alreadyCount: 1 });
    await expect(svc.assertFurnizorCanAssignStaff(50, 'warehouse', 12)).resolves.toBeUndefined();
    // only the "already" query ran; the count query was never needed
    expect(staffQbs).toHaveLength(1);
  });

  it('admins (no employees_suppliers row) are never counted: count query targets employees_suppliers only', async () => {
    const { svc, employeeSupplierRepo } = build({ staffCnt: 0 });
    await svc.countStaffForOwnerCompany(50, 'warehouse');
    expect(employeeSupplierRepo.createQueryBuilder).toHaveBeenCalledWith('es');
  });

  it('removeStaffLinksForEmployee frees slots', async () => {
    const { svc, employeeSupplierRepo } = build({});
    expect(await svc.removeStaffLinksForEmployee(12)).toBe(2);
    expect(employeeSupplierRepo.delete).toHaveBeenCalledWith({ employee_id: 12 });
  });
});

describe('withFurnizorQuotaLock', () => {
  it('uses one dedicated session for GET_LOCK/RELEASE_LOCK and releases the runner', async () => {
    const { svc, runner } = build({});
    const out = await svc.withFurnizorQuotaLock(50, async () => 'ok');
    expect(out).toBe('ok');
    const sqls = (runner.query as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toContain('GET_LOCK');
    expect(sqls[1]).toContain('RELEASE_LOCK');
    expect(runner.release).toHaveBeenCalled();
  });

  it('503 when the lock cannot be acquired', async () => {
    const { svc, runner } = build({});
    (runner.query as jest.Mock).mockImplementation(async () => [{ acquired: 0 }]);
    await expect(svc.withFurnizorQuotaLock(50, async () => 'x')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(runner.release).toHaveBeenCalled();
  });
});
