/**
 * Furnizor downgrade lifecycle: preview / apply / rollback soft-blocks for
 * clients (quota_status=blocked) and staff (employees_suppliers.is_active=0).
 * Locations are handled by locations-ms; company-ms orchestrates both.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClientSupplierLink } from './entities/client-supplier-link.entity';
import { EmployeeSupplier } from './entities/employee-supplier.entity';
import {
  StaffRole,
  SupplierPlanQuotaService,
  FURNIZOR_QUOTA_CODES,
} from './supplier-plan-quota.service';
import {
  SUPPLIER_QUOTA_STATUS,
  normalizeSupplierQuotaStatus,
} from './supplier-quota-status';
import { PlanAccessService } from '../plan-access/plan-access.nest';
import { PLAN_LIMIT_KEYS } from '@giurom/tenant-access';

export type FurnizorDowngradeResourceItem = {
  id: number;
  name: string;
};

export type FurnizorDowngradeBucket = {
  limit: number;
  used: number;
  minimum_to_block: number;
  items: FurnizorDowngradeResourceItem[];
};

export type FurnizorDowngradePreviewView = {
  plan_code: string;
  requires_blocks: boolean;
  clients: FurnizorDowngradeBucket;
  staff_warehouse: FurnizorDowngradeBucket;
  staff_driver: FurnizorDowngradeBucket;
  /** Populated by callers that merge locations-ms preview (optional). */
  locations?: FurnizorDowngradeBucket;
};

export type FurnizorDowngradeRollbackItem =
  | {
      kind: 'client';
      client_company_id: number;
      supplier_id: number;
      previous_status: string;
    }
  | {
      kind: 'staff';
      employee_id: number;
      supplier_id: number;
      role: StaffRole;
      previous_is_active: boolean;
    };

export type ApplyFurnizorDowngradeBlocksInput = {
  companyId: number;
  clientsLimit: number;
  warehouseLimit: number;
  driverLimit: number;
  blockClientCompanyIds: number[];
  blockStaffWarehouseEmployeeIds: number[];
  blockStaffDriverEmployeeIds: number[];
};

@Injectable()
export class FurnizorQuotaLifecycleService {
  private readonly logger = new Logger(FurnizorQuotaLifecycleService.name);

  constructor(
    @InjectRepository(ClientSupplierLink)
    private readonly clientSupplierLinkRepo: Repository<ClientSupplierLink>,
    @InjectRepository(EmployeeSupplier)
    private readonly employeeSupplierRepo: Repository<EmployeeSupplier>,
    private readonly planQuota: SupplierPlanQuotaService,
    private readonly planAccess: PlanAccessService,
  ) {}

  private bucket(
    limit: number,
    items: FurnizorDowngradeResourceItem[],
  ): FurnizorDowngradeBucket {
    const used = items.length;
    const lim = Math.max(0, Number(limit) || 0);
    const minimum_to_block = Math.max(0, used - lim);
    return { limit: lim, used, minimum_to_block, items };
  }

  /**
   * Distinct client companies currently consuming clients.max for this furnizor.
   * Name map is optional (caller may enrich).
   */
  async listCountableClients(
    ownerCompanyId: number,
    nameById?: Map<number, string>,
  ): Promise<FurnizorDowngradeResourceItem[]> {
    const supplierIds =
      await this.planQuota.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) return [];
    const rows = await this.clientSupplierLinkRepo
      .createQueryBuilder('csl')
      .select('DISTINCT csl.client_company_id', 'client_company_id')
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
      .orderBy('csl.client_company_id', 'ASC')
      .getRawMany<{ client_company_id: number | string }>();

    return rows
      .map((r) => Number(r.client_company_id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => ({
        id,
        name: nameById?.get(id) || `Client #${id}`,
      }));
  }

  async listActiveStaff(
    ownerCompanyId: number,
    role: StaffRole,
    nameById?: Map<number, string>,
  ): Promise<FurnizorDowngradeResourceItem[]> {
    const supplierIds =
      await this.planQuota.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) return [];
    const rows = await this.employeeSupplierRepo
      .createQueryBuilder('es')
      .select('DISTINCT es.employee_id', 'employee_id')
      .where('es.supplier_id IN (:...supplierIds)', { supplierIds })
      .andWhere('es.role = :role', { role })
      .andWhere('(es.is_active IS NULL OR es.is_active = true OR es.is_active = 1)')
      .orderBy('es.employee_id', 'ASC')
      .getRawMany<{ employee_id: number | string }>();

    return rows
      .map((r) => Number(r.employee_id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => ({
        id,
        name: nameById?.get(id) || `Angajat #${id}`,
      }));
  }

  buildDowngradePreview(
    planCode: string,
    clientsLimit: number,
    warehouseLimit: number,
    driverLimit: number,
    clients: FurnizorDowngradeResourceItem[],
    warehouse: FurnizorDowngradeResourceItem[],
    drivers: FurnizorDowngradeResourceItem[],
    locations?: FurnizorDowngradeBucket,
  ): FurnizorDowngradePreviewView {
    const clientsBucket = this.bucket(clientsLimit, clients);
    const warehouseBucket = this.bucket(warehouseLimit, warehouse);
    const driverBucket = this.bucket(driverLimit, drivers);
    const locationMinimum = locations?.minimum_to_block || 0;
    return {
      plan_code: planCode,
      requires_blocks:
        clientsBucket.minimum_to_block > 0 ||
        warehouseBucket.minimum_to_block > 0 ||
        driverBucket.minimum_to_block > 0 ||
        locationMinimum > 0,
      clients: clientsBucket,
      staff_warehouse: warehouseBucket,
      staff_driver: driverBucket,
      ...(locations ? { locations } : {}),
    };
  }

  validateDowngradeBlockSelection(
    preview: FurnizorDowngradePreviewView,
    blockClientIds: number[],
    blockWarehouseIds: number[],
    blockDriverIds: number[],
  ): void {
    if (!preview.requires_blocks) return;

    const clientSet = new Set(preview.clients.items.map((i) => i.id));
    const warehouseSet = new Set(preview.staff_warehouse.items.map((i) => i.id));
    const driverSet = new Set(preview.staff_driver.items.map((i) => i.id));

    for (const id of blockClientIds) {
      if (!clientSet.has(id)) {
        throw new BadRequestException(
          `Clientul ${id} nu poate fi blocat pentru această companie`,
        );
      }
    }
    for (const id of blockWarehouseIds) {
      if (!warehouseSet.has(id)) {
        throw new BadRequestException(
          `Magazionerul ${id} nu poate fi blocat pentru această companie`,
        );
      }
    }
    for (const id of blockDriverIds) {
      if (!driverSet.has(id)) {
        throw new BadRequestException(
          `Șoferul ${id} nu poate fi blocat pentru această companie`,
        );
      }
    }

    const remainingClients = preview.clients.used - blockClientIds.length;
    const remainingWarehouse =
      preview.staff_warehouse.used - blockWarehouseIds.length;
    const remainingDrivers = preview.staff_driver.used - blockDriverIds.length;

    if (remainingClients > preview.clients.limit) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DOWNGRADE_INSUFFICIENT_CLIENT_BLOCKS',
        message: `Trebuie blocați cel puțin ${preview.clients.minimum_to_block} clienți.`,
        details: {
          minimum_to_block: preview.clients.minimum_to_block,
          selected: blockClientIds.length,
        },
      });
    }
    if (remainingWarehouse > preview.staff_warehouse.limit) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DOWNGRADE_INSUFFICIENT_STAFF_WAREHOUSE_BLOCKS',
        message: `Trebuie blocați cel puțin ${preview.staff_warehouse.minimum_to_block} magazioneri.`,
        details: {
          minimum_to_block: preview.staff_warehouse.minimum_to_block,
          selected: blockWarehouseIds.length,
        },
      });
    }
    if (remainingDrivers > preview.staff_driver.limit) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DOWNGRADE_INSUFFICIENT_STAFF_DRIVER_BLOCKS',
        message: `Trebuie blocați cel puțin ${preview.staff_driver.minimum_to_block} șoferi.`,
        details: {
          minimum_to_block: preview.staff_driver.minimum_to_block,
          selected: blockDriverIds.length,
        },
      });
    }
  }

  async applyDowngradeBlocks(
    input: ApplyFurnizorDowngradeBlocksInput,
  ): Promise<FurnizorDowngradeRollbackItem[]> {
    const companyId = Number(input.companyId);
    return this.planQuota.withFurnizorQuotaLock(companyId, async () => {
      const [clients, warehouse, drivers] = await Promise.all([
        this.listCountableClients(companyId),
        this.listActiveStaff(companyId, 'warehouse'),
        this.listActiveStaff(companyId, 'driver'),
      ]);
      const preview = this.buildDowngradePreview(
        '',
        input.clientsLimit,
        input.warehouseLimit,
        input.driverLimit,
        clients,
        warehouse,
        drivers,
      );
      // Locations are validated by locations-ms; ignore locations.requires here.
      const suppliersRequires =
        preview.clients.minimum_to_block > 0 ||
        preview.staff_warehouse.minimum_to_block > 0 ||
        preview.staff_driver.minimum_to_block > 0;
      if (suppliersRequires) {
        this.validateDowngradeBlockSelection(
          { ...preview, requires_blocks: true },
          input.blockClientCompanyIds,
          input.blockStaffWarehouseEmployeeIds,
          input.blockStaffDriverEmployeeIds,
        );
      }

      const rollback: FurnizorDowngradeRollbackItem[] = [];
      const clientIds = [
        ...new Set(input.blockClientCompanyIds.map(Number).filter((n) => n > 0)),
      ];
      const warehouseIds = [
        ...new Set(
          input.blockStaffWarehouseEmployeeIds.map(Number).filter((n) => n > 0),
        ),
      ];
      const driverIds = [
        ...new Set(
          input.blockStaffDriverEmployeeIds.map(Number).filter((n) => n > 0),
        ),
      ];

      for (const clientCompanyId of clientIds) {
        const items = await this.blockClientForOwner(companyId, clientCompanyId);
        rollback.push(...items);
      }
      for (const employeeId of warehouseIds) {
        const items = await this.blockStaffForOwner(
          companyId,
          employeeId,
          'warehouse',
        );
        rollback.push(...items);
      }
      for (const employeeId of driverIds) {
        const items = await this.blockStaffForOwner(
          companyId,
          employeeId,
          'driver',
        );
        rollback.push(...items);
      }
      return rollback;
    });
  }

  private async blockClientForOwner(
    ownerCompanyId: number,
    clientCompanyId: number,
  ): Promise<FurnizorDowngradeRollbackItem[]> {
    const supplierIds =
      await this.planQuota.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) {
      throw new BadRequestException(
        `Clientul ${clientCompanyId} nu poate fi blocat pentru această companie`,
      );
    }
    const links = await this.clientSupplierLinkRepo.find({
      where: {
        client_company_id: clientCompanyId,
        supplier_id: In(supplierIds),
      },
    });
    const rollback: FurnizorDowngradeRollbackItem[] = [];
    let touched = false;
    for (const link of links) {
      const previous = normalizeSupplierQuotaStatus(link.quota_status);
      if (previous === SUPPLIER_QUOTA_STATUS.REMOVED) continue;
      if (previous === SUPPLIER_QUOTA_STATUS.BLOCKED) {
        touched = true;
        continue;
      }
      link.quota_status = SUPPLIER_QUOTA_STATUS.BLOCKED;
      await this.clientSupplierLinkRepo.save(link);
      rollback.push({
        kind: 'client',
        client_company_id: clientCompanyId,
        supplier_id: Number(link.supplier_id),
        previous_status: previous,
      });
      touched = true;
    }
    if (!touched) {
      throw new BadRequestException(
        `Clientul ${clientCompanyId} nu poate fi blocat pentru această companie`,
      );
    }
    return rollback;
  }

  private async blockStaffForOwner(
    ownerCompanyId: number,
    employeeId: number,
    role: StaffRole,
  ): Promise<FurnizorDowngradeRollbackItem[]> {
    const supplierIds =
      await this.planQuota.getSupplierIdsForOwnerCompany(ownerCompanyId);
    if (!supplierIds.length) {
      throw new BadRequestException(
        `Angajatul ${employeeId} nu poate fi blocat pentru această companie`,
      );
    }
    const links = await this.employeeSupplierRepo.find({
      where: {
        employee_id: employeeId,
        role,
        supplier_id: In(supplierIds),
      },
    });
    const rollback: FurnizorDowngradeRollbackItem[] = [];
    let touched = false;
    for (const link of links) {
      const wasActive = link.is_active !== false;
      if (!wasActive) {
        touched = true;
        continue;
      }
      link.is_active = false;
      await this.employeeSupplierRepo.save(link);
      rollback.push({
        kind: 'staff',
        employee_id: employeeId,
        supplier_id: Number(link.supplier_id),
        role,
        previous_is_active: true,
      });
      touched = true;
    }
    if (!touched) {
      throw new BadRequestException(
        `Angajatul ${employeeId} (${role}) nu poate fi blocat pentru această companie`,
      );
    }
    return rollback;
  }

  async rollbackDowngradeBlocks(
    companyId: number,
    items: FurnizorDowngradeRollbackItem[],
  ): Promise<void> {
    if (!items?.length) return;
    const cid = Number(companyId);
    const supplierIds = await this.planQuota.getSupplierIdsForOwnerCompany(cid);
    const owned = new Set(supplierIds);

    for (const item of items) {
      if (item.kind === 'client') {
        if (!owned.has(Number(item.supplier_id))) continue;
        const link = await this.clientSupplierLinkRepo.findOne({
          where: {
            client_company_id: item.client_company_id,
            supplier_id: item.supplier_id,
          },
        });
        if (!link) continue;
        link.quota_status = item.previous_status;
        await this.clientSupplierLinkRepo.save(link);
      } else {
        if (!owned.has(Number(item.supplier_id))) continue;
        const link = await this.employeeSupplierRepo.findOne({
          where: {
            employee_id: item.employee_id,
            supplier_id: item.supplier_id,
            role: item.role,
          },
        });
        if (!link) continue;
        link.is_active = item.previous_is_active !== false;
        await this.employeeSupplierRepo.save(link);
      }
    }
  }

  /**
   * Manual unblock of a client link owned by this furnizor — asserts clients.max.
   * Sets all matching Cont links for that client back to active.
   */
  async unblockClientForOwner(
    ownerCompanyId: number,
    clientCompanyId: number,
  ): Promise<void> {
    const cid = Number(ownerCompanyId);
    const clientId = Number(clientCompanyId);
    await this.planQuota.withFurnizorQuotaLock(cid, async () => {
      const supplierIds = await this.planQuota.getSupplierIdsForOwnerCompany(cid);
      if (!supplierIds.length) {
        throw new NotFoundException('Nu există furnizor Cont pentru această companie');
      }
      const links = await this.clientSupplierLinkRepo.find({
        where: {
          client_company_id: clientId,
          supplier_id: In(supplierIds),
        },
      });
      const blocked = links.filter(
        (l) =>
          normalizeSupplierQuotaStatus(l.quota_status) ===
          SUPPLIER_QUOTA_STATUS.BLOCKED,
      );
      if (!blocked.length) {
        throw new BadRequestException('Clientul nu este blocat de abonament');
      }
      await this.planAccess.assertLimitForCompany(
        cid,
        PLAN_LIMIT_KEYS.CLIENTS_MAX,
        () => this.planQuota.countDistinctClientsForOwnerCompany(cid),
        {
          code: FURNIZOR_QUOTA_CODES.CLIENTS,
          message:
            'Nu există slot disponibil în abonament pentru deblocarea acestui client.',
        },
      );
      for (const link of blocked) {
        link.quota_status = SUPPLIER_QUOTA_STATUS.ACTIVE;
        await this.clientSupplierLinkRepo.save(link);
      }
    });
  }

  /** Manual reactivate of staff link(s) for an employee+role under this furnizor. */
  async reactivateStaffForOwner(
    ownerCompanyId: number,
    employeeId: number,
    role: StaffRole,
  ): Promise<void> {
    const cid = Number(ownerCompanyId);
    const eid = Number(employeeId);
    await this.planQuota.withFurnizorQuotaLock(cid, async () => {
      const supplierIds = await this.planQuota.getSupplierIdsForOwnerCompany(cid);
      if (!supplierIds.length) {
        throw new NotFoundException('Nu există furnizor Cont pentru această companie');
      }
      const links = await this.employeeSupplierRepo.find({
        where: {
          employee_id: eid,
          role,
          supplier_id: In(supplierIds),
        },
      });
      const inactive = links.filter((l) => l.is_active === false);
      if (!inactive.length) {
        throw new BadRequestException('Angajatul nu este blocat de abonament');
      }
      await this.planQuota.assertFurnizorCanAssignStaff(cid, role, eid);
      for (const link of inactive) {
        link.is_active = true;
        await this.employeeSupplierRepo.save(link);
      }
    });
  }
}
