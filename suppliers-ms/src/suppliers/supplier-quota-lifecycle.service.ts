/**
 * Quota lifecycle: block/unblock/remove/downgrade for Cont + Manual suppliers.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, In, Repository } from 'typeorm';
import { ClientSupplierLink } from './entities/client-supplier-link.entity';
import { ClientManualSupplierState } from './entities/client-manual-supplier-state.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { SupplierOrder } from './entities/supplier-order.entity';
import {
  SUPPLIER_QUOTA_STATUS,
  SupplierQuotaStatus,
  TERMINAL_SUPPLIER_ORDER_STATUSES,
  normalizeSupplierQuotaStatus,
  supplierQuotaStatusCountsTowardLimit,
  supplierQuotaStatusIsAccessible,
} from './supplier-quota-status';
import {
  SUPPLIER_LIMIT_KEYS,
  SupplierQuotaService,
} from './supplier-quota.service';

export type QuotaSupplierListItem = {
  supplier_id: number;
  supplier_name: string;
  is_active: boolean;
  quota_status: SupplierQuotaStatus;
  has_supplier_account: boolean;
};

export type DowngradePreviewView = {
  plan_code: string;
  requires_blocks: boolean;
  account: {
    limit: number;
    used: number;
    minimum_to_block: number;
    suppliers: QuotaSupplierListItem[];
  };
  manual: {
    limit: number;
    used: number;
    minimum_to_block: number;
    suppliers: QuotaSupplierListItem[];
  };
};

export type DowngradeBlockRollbackItem = {
  kind: 'account' | 'manual';
  supplier_id: number;
  previous_status: SupplierQuotaStatus;
};

export type ApplyDowngradeBlocksInput = {
  companyId: number;
  companyLocationIds: number[];
  accountLimit: number;
  manualLimit: number;
  blockAccountSupplierIds: number[];
  blockManualSupplierIds: number[];
};

@Injectable()
export class SupplierQuotaLifecycleService {
  private readonly logger = new Logger(SupplierQuotaLifecycleService.name);

  constructor(
    @InjectRepository(ClientSupplierLink)
    private readonly clientSupplierLinkRepo: Repository<ClientSupplierLink>,
    @InjectRepository(ClientManualSupplierState)
    private readonly manualStateRepo: Repository<ClientManualSupplierState>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierLocations)
    private readonly supplierLocationsRepo: Repository<SupplierLocations>,
    @InjectRepository(SupplierOrder)
    private readonly supplierOrderRepo: Repository<SupplierOrder>,
    @InjectConnection() private readonly connection: Connection,
    private readonly supplierQuotaService: SupplierQuotaService,
  ) {}

  async countAccountSuppliersUsingQuota(companyId: number): Promise<number> {
    return this.clientSupplierLinkRepo.count({
      where: {
        client_company_id: Number(companyId),
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
      },
    });
  }

  async countManualSuppliersUsingQuota(
    companyId: number,
    companyLocationIds: number[],
  ): Promise<number> {
    if (!companyLocationIds.length) return 0;
    const rows = await this.supplierLocationsRepo
      .createQueryBuilder('sl')
      .innerJoin(Supplier, 's', 's.id = sl.supplier_id')
      .leftJoin(
        ClientManualSupplierState,
        'cms',
        'cms.supplier_id = sl.supplier_id AND cms.client_company_id = :companyId',
        { companyId: Number(companyId) },
      )
      .select('COUNT(DISTINCT sl.supplier_id)', 'cnt')
      .where('sl.id_location IN (:...locationIds)', {
        locationIds: companyLocationIds,
      })
      .andWhere('(s.owner_company_id IS NULL OR s.owner_company_id = 0)')
      .andWhere(
        '(cms.id IS NULL OR cms.quota_status = :activeStatus)',
        { activeStatus: SUPPLIER_QUOTA_STATUS.ACTIVE },
      )
      .getRawOne<{ cnt: string | number }>();
    return Number(rows?.cnt || 0);
  }

  async getAccountLink(
    companyId: number,
    supplierId: number,
  ): Promise<ClientSupplierLink | null> {
    return this.clientSupplierLinkRepo.findOne({
      where: {
        client_company_id: Number(companyId),
        supplier_id: Number(supplierId),
      },
    });
  }

  async getManualState(
    companyId: number,
    supplierId: number,
  ): Promise<ClientManualSupplierState | null> {
    return this.manualStateRepo.findOne({
      where: {
        client_company_id: Number(companyId),
        supplier_id: Number(supplierId),
      },
    });
  }

  resolveManualQuotaStatus(
    state: ClientManualSupplierState | null | undefined,
  ): SupplierQuotaStatus {
    return normalizeSupplierQuotaStatus(state?.quota_status);
  }

  resolveAccountQuotaStatus(
    link: ClientSupplierLink | null | undefined,
  ): SupplierQuotaStatus {
    return normalizeSupplierQuotaStatus(link?.quota_status);
  }

  async hasActiveAccountLink(
    companyId: number,
    supplierId: number,
  ): Promise<boolean> {
    const link = await this.getAccountLink(companyId, supplierId);
    if (!link) return false;
    return (
      this.resolveAccountQuotaStatus(link) !== SUPPLIER_QUOTA_STATUS.REMOVED
    );
  }

  async assertSupplierQuotaAccessible(
    companyId: number,
    supplier: Supplier,
    hasAccount: boolean,
  ): Promise<void> {
    if (!Number.isFinite(companyId) || companyId <= 0) return;

    if (hasAccount) {
      const link = await this.getAccountLink(companyId, supplier.id);
      const status = this.resolveAccountQuotaStatus(link);
      if (!link || status === SUPPLIER_QUOTA_STATUS.REMOVED) {
        throw new NotFoundException(
          `Furnizorul cu ID ${supplier.id} nu a fost găsit`,
        );
      }
      if (!supplierQuotaStatusIsAccessible(status)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'SUPPLIER_QUOTA_BLOCKED',
          message: 'Acest furnizor este blocat de abonament și nu poate fi accesat.',
        });
      }
      return;
    }

    const ownerId = Number(supplier.owner_company_id);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      return;
    }

    const state = await this.getManualState(companyId, supplier.id);
    const status = this.resolveManualQuotaStatus(state);
    if (status === SUPPLIER_QUOTA_STATUS.REMOVED) {
      throw new NotFoundException(
        `Furnizorul cu ID ${supplier.id} nu a fost găsit`,
      );
    }
    if (!supplierQuotaStatusIsAccessible(status)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SUPPLIER_QUOTA_BLOCKED',
        message: 'Acest furnizor este blocat de abonament și nu poate fi accesat.',
      });
    }
  }

  async assertNoActiveOrdersForRemove(
    companyId: number,
    supplierId: number,
  ): Promise<void> {
    const active = await this.supplierOrderRepo
      .createQueryBuilder('o')
      .where('o.supplier_id = :supplierId', { supplierId: Number(supplierId) })
      .andWhere('o.company_id = :companyId', { companyId: Number(companyId) })
      .andWhere('o.status NOT IN (:...terminal)', {
        terminal: Array.from(TERMINAL_SUPPLIER_ORDER_STATUSES),
      })
      .getCount();

    if (active > 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'SUPPLIER_REMOVE_BLOCKED_BY_ORDERS',
        message:
          'Furnizorul nu poate fi eliminat cât timp există comenzi în curs. Finalizează sau anulează comenzile înainte de eliminare.',
      });
    }
  }

  async listAccountSuppliersForQuota(
    companyId: number,
    onlyActiveQuota = false,
  ): Promise<QuotaSupplierListItem[]> {
    const links = await this.clientSupplierLinkRepo.find({
      where: {
        client_company_id: Number(companyId),
        ...(onlyActiveQuota
          ? { quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE }
          : {}),
      },
      relations: ['supplier'],
      order: { created_at: 'ASC' },
    });
    return links
      .filter(
        (l) =>
          !onlyActiveQuota ||
          supplierQuotaStatusCountsTowardLimit(
            this.resolveAccountQuotaStatus(l),
          ),
      )
      .map((l) => ({
        supplier_id: Number(l.supplier_id),
        supplier_name: String(l.supplier?.supplier_name || ''),
        is_active: l.is_active !== false,
        quota_status: this.resolveAccountQuotaStatus(l),
        has_supplier_account: true,
      }));
  }

  async listManualSuppliersForQuota(
    companyId: number,
    companyLocationIds: number[],
    onlyActiveQuota = false,
  ): Promise<QuotaSupplierListItem[]> {
    if (!companyLocationIds.length) return [];
    const rows = await this.supplierLocationsRepo
      .createQueryBuilder('sl')
      .innerJoin(Supplier, 's', 's.id = sl.supplier_id')
      .leftJoin(
        ClientManualSupplierState,
        'cms',
        'cms.supplier_id = sl.supplier_id AND cms.client_company_id = :companyId',
        { companyId: Number(companyId) },
      )
      .select('s.id', 'supplier_id')
      .addSelect('s.supplier_name', 'supplier_name')
      .addSelect('s.is_active', 'is_active')
      .addSelect('cms.quota_status', 'quota_status')
      .distinct(true)
      .where('sl.id_location IN (:...locationIds)', {
        locationIds: companyLocationIds,
      })
      .andWhere('(s.owner_company_id IS NULL OR s.owner_company_id = 0)')
      .orderBy('s.supplier_name', 'ASC')
      .getRawMany<{
        supplier_id: number | string;
        supplier_name: string;
        is_active: number | boolean;
        quota_status: string | null;
      }>();

    const items = rows.map((r) => ({
      supplier_id: Number(r.supplier_id),
      supplier_name: String(r.supplier_name || ''),
      is_active: r.is_active === true || r.is_active === 1,
      quota_status: normalizeSupplierQuotaStatus(r.quota_status),
      has_supplier_account: false,
    }));

    if (!onlyActiveQuota) {
      return items.filter(
        (i) => i.quota_status !== SUPPLIER_QUOTA_STATUS.REMOVED,
      );
    }
    return items.filter((i) =>
      supplierQuotaStatusCountsTowardLimit(i.quota_status),
    );
  }

  buildDowngradePreview(
    planCode: string,
    accountLimit: number,
    manualLimit: number,
    accountSuppliers: QuotaSupplierListItem[],
    manualSuppliers: QuotaSupplierListItem[],
  ): DowngradePreviewView {
    const accountUsed = accountSuppliers.length;
    const manualUsed = manualSuppliers.length;
    const accountMinimum = Math.max(0, accountUsed - accountLimit);
    const manualMinimum = Math.max(0, manualUsed - manualLimit);
    return {
      plan_code: planCode,
      requires_blocks: accountMinimum > 0 || manualMinimum > 0,
      account: {
        limit: accountLimit,
        used: accountUsed,
        minimum_to_block: accountMinimum,
        suppliers: accountSuppliers,
      },
      manual: {
        limit: manualLimit,
        used: manualUsed,
        minimum_to_block: manualMinimum,
        suppliers: manualSuppliers,
      },
    };
  }

  validateDowngradeBlockSelection(
    preview: DowngradePreviewView,
    blockAccountIds: number[],
    blockManualIds: number[],
  ): void {
    if (!preview.requires_blocks) return;

    const accountSet = new Set(
      preview.account.suppliers.map((s) => s.supplier_id),
    );
    const manualSet = new Set(
      preview.manual.suppliers.map((s) => s.supplier_id),
    );

    for (const id of blockAccountIds) {
      if (!accountSet.has(id)) {
        throw new BadRequestException(
          `Furnizorul Cont ${id} nu poate fi blocat pentru această companie`,
        );
      }
    }
    for (const id of blockManualIds) {
      if (!manualSet.has(id)) {
        throw new BadRequestException(
          `Furnizorul Manual ${id} nu poate fi blocat pentru această companie`,
        );
      }
    }

    const remainingAccount =
      preview.account.used - blockAccountIds.length;
    const remainingManual = preview.manual.used - blockManualIds.length;

    if (remainingAccount > preview.account.limit) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DOWNGRADE_INSUFFICIENT_ACCOUNT_BLOCKS',
        message: `Trebuie blocați cel puțin ${preview.account.minimum_to_block} furnizori Cu cont.`,
        details: {
          minimum_to_block: preview.account.minimum_to_block,
          selected: blockAccountIds.length,
        },
      });
    }
    if (remainingManual > preview.manual.limit) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'DOWNGRADE_INSUFFICIENT_MANUAL_BLOCKS',
        message: `Trebuie blocați cel puțin ${preview.manual.minimum_to_block} furnizori Manual.`,
        details: {
          minimum_to_block: preview.manual.minimum_to_block,
          selected: blockManualIds.length,
        },
      });
    }
  }

  async applyDowngradeBlocks(
    input: ApplyDowngradeBlocksInput,
  ): Promise<DowngradeBlockRollbackItem[]> {
    const companyId = Number(input.companyId);
    const rollback: DowngradeBlockRollbackItem[] = [];

    return this.supplierQuotaService.withCompanySupplierQuotaLock(
      companyId,
      async () => {
        const accountSuppliers = await this.listAccountSuppliersForQuota(
          companyId,
          true,
        );
        const manualSuppliers = await this.listManualSuppliersForQuota(
          companyId,
          input.companyLocationIds,
          true,
        );
        const preview = this.buildDowngradePreview(
          '',
          input.accountLimit,
          input.manualLimit,
          accountSuppliers,
          manualSuppliers,
        );
        this.validateDowngradeBlockSelection(
          preview,
          input.blockAccountSupplierIds,
          input.blockManualSupplierIds,
        );

        if (!preview.requires_blocks) {
          return rollback;
        }

        const accountIds = [...new Set(input.blockAccountSupplierIds.map(Number))];
        const manualIds = [...new Set(input.blockManualSupplierIds.map(Number))];

        if (accountIds.length) {
          const links = await this.clientSupplierLinkRepo.find({
            where: {
              client_company_id: companyId,
              supplier_id: In(accountIds),
            },
          });
          for (const link of links) {
            const previous = this.resolveAccountQuotaStatus(link);
            if (previous === SUPPLIER_QUOTA_STATUS.BLOCKED) continue;
            rollback.push({
              kind: 'account',
              supplier_id: Number(link.supplier_id),
              previous_status: previous,
            });
            link.quota_status = SUPPLIER_QUOTA_STATUS.BLOCKED;
          }
          await this.clientSupplierLinkRepo.save(links);
        }

        for (const supplierId of manualIds) {
          let state = await this.getManualState(companyId, supplierId);
          const previous = this.resolveManualQuotaStatus(state);
          if (previous === SUPPLIER_QUOTA_STATUS.BLOCKED) continue;
          rollback.push({
            kind: 'manual',
            supplier_id: supplierId,
            previous_status: previous,
          });
          if (!state) {
            state = this.manualStateRepo.create({
              client_company_id: companyId,
              supplier_id: supplierId,
              quota_status: SUPPLIER_QUOTA_STATUS.BLOCKED,
            });
          } else {
            state.quota_status = SUPPLIER_QUOTA_STATUS.BLOCKED;
          }
          await this.manualStateRepo.save(state);
        }

        return rollback;
      },
    );
  }

  async rollbackDowngradeBlocks(
    companyId: number,
    items: DowngradeBlockRollbackItem[],
  ): Promise<void> {
    if (!items.length) return;
    const cid = Number(companyId);
    for (const item of items) {
      if (item.kind === 'account') {
        const link = await this.getAccountLink(cid, item.supplier_id);
        if (link) {
          link.quota_status = item.previous_status;
          await this.clientSupplierLinkRepo.save(link);
        }
      } else {
        const state = await this.getManualState(cid, item.supplier_id);
        if (item.previous_status === SUPPLIER_QUOTA_STATUS.ACTIVE && state) {
          if (
            normalizeSupplierQuotaStatus(state.quota_status) ===
            SUPPLIER_QUOTA_STATUS.BLOCKED
          ) {
            await this.manualStateRepo.remove(state);
          }
        } else if (state) {
          state.quota_status = item.previous_status;
          await this.manualStateRepo.save(state);
        }
      }
    }
  }

  async unblockAccountSupplier(
    companyId: number,
    supplierId: number,
  ): Promise<void> {
    const link = await this.getAccountLink(companyId, supplierId);
    if (!link) {
      throw new NotFoundException('Nu există asociere Cont pentru acest furnizor');
    }
    if (
      this.resolveAccountQuotaStatus(link) !== SUPPLIER_QUOTA_STATUS.BLOCKED
    ) {
      throw new BadRequestException('Furnizorul nu este blocat de abonament');
    }

    await this.supplierQuotaService.withCompanySupplierQuotaLock(
      companyId,
      async () => {
        const used = await this.countAccountSuppliersUsingQuota(companyId);
        const limits = await this.supplierQuotaService.getSupplierLimits(
          companyId,
        );
        const limit = Number(
          limits.limits[SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX] ?? 1,
        );
        if (used + 1 > limit) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'SUPPLIER_ACCOUNT_LIMIT_REACHED',
            message:
              'Nu există slot disponibil în abonament pentru deblocarea acestui furnizor.',
          });
        }
        link.quota_status = SUPPLIER_QUOTA_STATUS.ACTIVE;
        await this.clientSupplierLinkRepo.save(link);
      },
    );
  }

  async unblockManualSupplier(
    companyId: number,
    supplierId: number,
    companyLocationIds: number[],
  ): Promise<void> {
    const state = await this.getManualState(companyId, supplierId);
    if (
      this.resolveManualQuotaStatus(state) !== SUPPLIER_QUOTA_STATUS.BLOCKED
    ) {
      throw new BadRequestException('Furnizorul nu este blocat de abonament');
    }

    await this.supplierQuotaService.withCompanySupplierQuotaLock(
      companyId,
      async () => {
        const used = await this.countManualSuppliersUsingQuota(
          companyId,
          companyLocationIds,
        );
        const limits = await this.supplierQuotaService.getSupplierLimits(
          companyId,
        );
        const limit = Number(
          limits.limits[SUPPLIER_LIMIT_KEYS.MANUAL_MAX] ?? 3,
        );
        if (used + 1 > limit) {
          throw new ForbiddenException({
            statusCode: 403,
            code: 'MANUAL_SUPPLIER_LIMIT_REACHED',
            message:
              'Nu există slot disponibil în abonament pentru deblocarea acestui furnizor.',
          });
        }
        if (state) {
          state.quota_status = SUPPLIER_QUOTA_STATUS.ACTIVE;
          await this.manualStateRepo.save(state);
        }
      },
    );
  }

  async removeAccountSupplierFromClient(
    companyId: number,
    supplierId: number,
  ): Promise<void> {
    const link = await this.getAccountLink(companyId, supplierId);
    if (!link) {
      throw new NotFoundException('Nu există asociere Cont pentru acest furnizor');
    }
    if (
      this.resolveAccountQuotaStatus(link) === SUPPLIER_QUOTA_STATUS.REMOVED
    ) {
      return;
    }
    await this.assertNoActiveOrdersForRemove(companyId, supplierId);
    link.quota_status = SUPPLIER_QUOTA_STATUS.REMOVED;
    await this.clientSupplierLinkRepo.save(link);
  }

  async removeManualSupplierFromClient(
    companyId: number,
    supplierId: number,
  ): Promise<void> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: Number(supplierId) },
      select: ['id', 'owner_company_id'],
    });
    if (!supplier) {
      throw new NotFoundException('Furnizorul nu a fost găsit');
    }
    const ownerId = Number(supplier.owner_company_id);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      throw new BadRequestException(
        'Eliminarea din cont se aplică doar furnizorilor Manual',
      );
    }

    const state = await this.getManualState(companyId, supplierId);
    if (
      this.resolveManualQuotaStatus(state) === SUPPLIER_QUOTA_STATUS.REMOVED
    ) {
      return;
    }
    await this.assertNoActiveOrdersForRemove(companyId, supplierId);

    if (state) {
      state.quota_status = SUPPLIER_QUOTA_STATUS.REMOVED;
      await this.manualStateRepo.save(state);
    } else {
      await this.manualStateRepo.save(
        this.manualStateRepo.create({
          client_company_id: companyId,
          supplier_id: supplierId,
          quota_status: SUPPLIER_QUOTA_STATUS.REMOVED,
        }),
      );
    }
  }

  async reactivateAccountLink(
    companyId: number,
    supplierId: number,
    linkedByUserId: number | null,
  ): Promise<ClientSupplierLink> {
    const existing = await this.getAccountLink(companyId, supplierId);
    if (
      existing &&
      this.resolveAccountQuotaStatus(existing) !== SUPPLIER_QUOTA_STATUS.REMOVED
    ) {
      return existing;
    }

    await this.supplierQuotaService.assertCanConnectAccountSupplier(companyId);

    if (existing) {
      existing.quota_status = SUPPLIER_QUOTA_STATUS.ACTIVE;
      existing.is_active = true;
      return this.clientSupplierLinkRepo.save(existing);
    }

    return this.clientSupplierLinkRepo.save(
      this.clientSupplierLinkRepo.create({
        client_company_id: companyId,
        supplier_id: supplierId,
        linked_by_user_id: linkedByUserId,
        is_active: true,
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
      }),
    );
  }

  async reactivateManualSupplier(
    companyId: number,
    supplierId: number,
    companyLocationIds: number[],
  ): Promise<void> {
    const state = await this.getManualState(companyId, supplierId);
    if (
      state &&
      this.resolveManualQuotaStatus(state) !== SUPPLIER_QUOTA_STATUS.REMOVED
    ) {
      return;
    }

    await this.supplierQuotaService.assertCanCreateManualSupplier(
      companyId,
      companyLocationIds,
    );

    if (state) {
      state.quota_status = SUPPLIER_QUOTA_STATUS.ACTIVE;
      state.is_active = true;
      await this.manualStateRepo.save(state);
    }
  }
}
