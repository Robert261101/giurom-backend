/**
 * Furnizor-side plan quotas (FREEZE-CREATE / FREEZE-ASSIGN + downgrade blocks):
 *   clients.max          — distinct client companies linked to the furnizor's
 *                          Cont suppliers via client_supplier_links where
 *                          quota_status NOT IN (removed, blocked).
 *                          is_active=false still consumes; blocked frees a slot.
 *   staff.warehouse.max  — distinct employees with role=warehouse AND is_active=1
 *   staff.driver.max     — distinct employees with role=driver AND is_active=1
 *
 * Downgrade may force soft-blocks (quota_status=blocked / is_active=0). Upgrade
 * does NOT auto-reactivate; manual reactivate must assert quota first.
 * Admin users (no employees_suppliers row) consume nothing.
 *
 * Pre-existing suppliers.account.max / suppliers.manual.max stay in SupplierQuotaService.
 */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { PLAN_LIMIT_KEYS } from '@giurom/tenant-access';
import { ClientSupplierLink } from './entities/client-supplier-link.entity';
import { EmployeeSupplier } from './entities/employee-supplier.entity';
import { Supplier } from './entities/supplier.entity';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';
import { PlanAccessService } from '../plan-access/plan-access.nest';

export type StaffRole = 'warehouse' | 'driver';

export const FURNIZOR_QUOTA_CODES = {
  CLIENTS: 'SUPPLIER_CLIENTS_LIMIT_REACHED',
  STAFF_WAREHOUSE: 'STAFF_WAREHOUSE_LIMIT_REACHED',
  STAFF_DRIVER: 'STAFF_DRIVER_LIMIT_REACHED',
} as const;

export function staffRoleToLimitKey(role: StaffRole): string {
  return role === 'warehouse'
    ? PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX
    : PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX;
}

export function normalizeStaffRole(value: unknown): StaffRole | null {
  const raw = String(value ?? '').toLowerCase().trim();
  if (raw === 'warehouse' || raw === 'magazioner') return 'warehouse';
  if (raw === 'driver' || raw === 'sofer' || raw === 'șofer') return 'driver';
  return null;
}

export type FurnizorQuotaUsage = {
  clients_used: number;
  staff_warehouse_used: number;
  staff_driver_used: number;
};

@Injectable()
export class SupplierPlanQuotaService {
  private readonly logger = new Logger(SupplierPlanQuotaService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(ClientSupplierLink)
    private readonly clientSupplierLinkRepo: Repository<ClientSupplierLink>,
    @InjectRepository(EmployeeSupplier)
    private readonly employeeSupplierRepo: Repository<EmployeeSupplier>,
    @InjectConnection() private readonly connection: Connection,
    private readonly planAccess: PlanAccessService,
  ) {}

  /**
   * Named lock per FURNIZOR company, held on a dedicated session (QueryRunner)
   * so GET_LOCK / RELEASE_LOCK always hit the same connection.
   */
  async withFurnizorQuotaLock<T>(
    ownerCompanyId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cid = Number(ownerCompanyId);
    if (!Number.isFinite(cid) || cid <= 0) return fn();
    const lockName = `giurom_furnizor_quota_${cid}`;
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    try {
      const rows: Array<{ acquired: number | string }> = await runner.query(
        'SELECT GET_LOCK(?, 10) AS acquired',
        [lockName],
      );
      if (Number(rows?.[0]?.acquired) !== 1) {
        throw new ServiceUnavailableException(
          'Nu s-a putut verifica limita de abonament a furnizorului. Reîncearcă.',
        );
      }
      try {
        return await fn();
      } finally {
        try {
          await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch (error: any) {
          this.logger.warn(
            `RELEASE_LOCK(${lockName}) failed: ${error?.message || error}`,
          );
        }
      }
    } finally {
      await runner.release();
    }
  }

  /** All supplier ids owned by a furnizor company (Cont suppliers). */
  async getSupplierIdsForOwnerCompany(ownerCompanyId: number): Promise<number[]> {
    const cid = Number(ownerCompanyId);
    if (!Number.isFinite(cid) || cid <= 0) return [];
    const rows = await this.supplierRepo.find({
      where: { owner_company_id: cid },
      select: ['id'],
    });
    return rows.map((r) => Number(r.id)).filter((id) => id > 0);
  }

  /** Owner (furnizor) company of a supplier — null for Manual suppliers. */
  async getOwnerCompanyIdForSupplier(supplierId: number): Promise<number | null> {
    const sid = Number(supplierId);
    if (!Number.isFinite(sid) || sid <= 0) return null;
    const supplier = await this.supplierRepo.findOne({
      where: { id: sid },
      select: ['id', 'owner_company_id'],
    });
    const owner = Number(supplier?.owner_company_id);
    return Number.isFinite(owner) && owner > 0 ? owner : null;
  }

  /**
   * clients.max usage: COUNT DISTINCT client_company_id over canonical links
   * excluding removed AND blocked (blocking frees a slot). is_active=false still
   * consumes.
   */
  async countDistinctClientsForOwnerCompany(ownerCompanyId: number): Promise<number> {
    const supplierIds = await this.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) return 0;
    const row = await this.clientSupplierLinkRepo
      .createQueryBuilder('csl')
      .select('COUNT(DISTINCT csl.client_company_id)', 'cnt')
      .where('csl.supplier_id IN (:...supplierIds)', { supplierIds })
      .andWhere(
        '(csl.quota_status IS NULL OR csl.quota_status NOT IN (:...excluded))',
        {
          excluded: [
            SUPPLIER_QUOTA_STATUS.REMOVED,
            SUPPLIER_QUOTA_STATUS.BLOCKED,
          ],
        },
      )
      .getRawOne<{ cnt: string | number }>();
    return Number(row?.cnt || 0);
  }

  /**
   * staff usage per role: COUNT DISTINCT employee_id on the furnizor's suppliers
   * where the link is active. `excludeEmployeeId` lets a re-assignment of the
   * same employee not count itself.
   */
  async countStaffForOwnerCompany(
    ownerCompanyId: number,
    role: StaffRole,
    excludeEmployeeId?: number | null,
  ): Promise<number> {
    const supplierIds = await this.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) return 0;
    const qb = this.employeeSupplierRepo
      .createQueryBuilder('es')
      .select('COUNT(DISTINCT es.employee_id)', 'cnt')
      .where('es.supplier_id IN (:...supplierIds)', { supplierIds })
      .andWhere('es.role = :role', { role })
      .andWhere('(es.is_active IS NULL OR es.is_active = true OR es.is_active = 1)');
    const exclude = Number(excludeEmployeeId);
    if (Number.isFinite(exclude) && exclude > 0) {
      qb.andWhere('es.employee_id != :exclude', { exclude });
    }
    const row = await qb.getRawOne<{ cnt: string | number }>();
    return Number(row?.cnt || 0);
  }

  async getUsageForOwnerCompany(ownerCompanyId: number): Promise<FurnizorQuotaUsage> {
    const [clients_used, staff_warehouse_used, staff_driver_used] =
      await Promise.all([
        this.countDistinctClientsForOwnerCompany(ownerCompanyId),
        this.countStaffForOwnerCompany(ownerCompanyId, 'warehouse'),
        this.countStaffForOwnerCompany(ownerCompanyId, 'driver'),
      ]);
    return { clients_used, staff_warehouse_used, staff_driver_used };
  }

  /**
   * Freeze-create gate for a NEW client link on the furnizor's quota.
   * Called from connect (new link or reactivation of a removed/blocked link).
   * 403 SUPPLIER_CLIENTS_LIMIT_REACHED — the client receives an explicit message.
   */
  async assertFurnizorCanAcceptClient(ownerCompanyId: number): Promise<void> {
    const cid = Number(ownerCompanyId);
    if (!Number.isFinite(cid) || cid <= 0) return; // Manual supplier: no furnizor quota
    await this.planAccess.assertLimitForCompany(
      cid,
      PLAN_LIMIT_KEYS.CLIENTS_MAX,
      () => this.countDistinctClientsForOwnerCompany(cid),
      {
        code: FURNIZOR_QUOTA_CODES.CLIENTS,
        message:
          'Furnizorul a atins limita de clienți pentru planul său de abonament. Asocierea nu poate fi realizată acum.',
      },
    );
  }

  /**
   * Freeze-assign gate for giving `employeeId` the operational `role` on the
   * furnizor's suppliers. If the employee already holds an *active* link for that
   * role, no new slot is consumed. Reactivating an inactive link consumes a slot.
   */
  async assertFurnizorCanAssignStaff(
    ownerCompanyId: number,
    role: StaffRole,
    employeeId?: number | null,
  ): Promise<void> {
    const cid = Number(ownerCompanyId);
    if (!Number.isFinite(cid) || cid <= 0) return;
    const eid = Number(employeeId);
    const hasEmployee = Number.isFinite(eid) && eid > 0;
    if (hasEmployee) {
      const supplierIds = await this.getSupplierIdsForOwnerCompany(cid);
      if (supplierIds.length) {
        const already = await this.employeeSupplierRepo
          .createQueryBuilder('es')
          .where('es.supplier_id IN (:...supplierIds)', { supplierIds })
          .andWhere('es.employee_id = :eid', { eid })
          .andWhere('es.role = :role', { role })
          .andWhere(
            '(es.is_active IS NULL OR es.is_active = true OR es.is_active = 1)',
          )
          .getCount();
        if (already > 0) return;
      }
    }
    await this.planAccess.assertLimitForCompany(
      cid,
      staffRoleToLimitKey(role),
      () => this.countStaffForOwnerCompany(cid, role, hasEmployee ? eid : null),
      {
        code:
          role === 'warehouse'
            ? FURNIZOR_QUOTA_CODES.STAFF_WAREHOUSE
            : FURNIZOR_QUOTA_CODES.STAFF_DRIVER,
        message:
          role === 'warehouse'
            ? 'Ai atins limita de magazioneri pentru planul actual de abonament.'
            : 'Ai atins limita de șoferi pentru planul actual de abonament.',
      },
    );
  }

  /** Frees staff slots when an employee is deleted (called internally by employees-ms). */
  async removeStaffLinksForEmployee(employeeId: number): Promise<number> {
    const eid = Number(employeeId);
    if (!Number.isFinite(eid) || eid <= 0) return 0;
    const result = await this.employeeSupplierRepo.delete({ employee_id: eid });
    return Number(result.affected || 0);
  }
}
