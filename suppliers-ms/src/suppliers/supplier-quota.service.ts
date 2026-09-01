/**
 * Supplier subscription quota (Phase 2).
 * Usage is company-wide — never count supplier_locations rows.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ClientSupplierLink } from './entities/client-supplier-link.entity';
import { ClientManualSupplierState } from './entities/client-manual-supplier-state.entity';
import { SupplierLocations } from './entities/supplier-locations.entity';
import { Supplier } from './entities/supplier.entity';
import { SUPPLIER_QUOTA_STATUS } from './supplier-quota-status';

export const SUPPLIER_LIMIT_KEYS = {
  ACCOUNT_MAX: 'suppliers.account.max',
  MANUAL_MAX: 'suppliers.manual.max',
} as const;

const DEFAULT_FREE_LIMITS: Record<string, number> = {
  [SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX]: 1,
  [SUPPLIER_LIMIT_KEYS.MANUAL_MAX]: 3,
};

export type SupplierSubscriptionLimits = {
  plan_code: string;
  plan_name: string;
  status: string;
  limits: Record<string, number>;
};

export type SupplierUsageSnapshot = {
  account_used: number;
  manual_used: number;
};

export type SupplierSubscriptionUsageView = SupplierSubscriptionLimits &
  SupplierUsageSnapshot & {
    account_limit: number;
    manual_limit: number;
    account_over_limit: boolean;
    manual_over_limit: boolean;
  };

@Injectable()
export class SupplierQuotaService {
  private readonly logger = new Logger(SupplierQuotaService.name);
  private readonly companiesUrl: string;
  private readonly serviceSecret: string;

  constructor(
    @InjectRepository(ClientSupplierLink)
    private readonly clientSupplierLinkRepo: Repository<ClientSupplierLink>,
    @InjectRepository(SupplierLocations)
    private readonly supplierLocationsRepo: Repository<SupplierLocations>,
    @InjectConnection() private readonly connection: Connection,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.companiesUrl = (
      this.configService.get<string>('COMPANIES_HTTP_URL') ||
      process.env.COMPANIES_HTTP_URL ||
      'http://localhost:3003'
    ).replace(/\/$/, '');
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET ||
      '';
  }

  /**
   * MySQL named lock per company — serializes connect/create that consume quota.
   * Seed/sync/location create must NOT use this lock.
   */
  async withCompanySupplierQuotaLock<T>(
    companyId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return fn();
    }
    const lockName = `giurom_supplier_quota_${cid}`;
    const acquiredRows: Array<{ acquired: number | string }> =
      await this.connection.query('SELECT GET_LOCK(?, 10) AS acquired', [
        lockName,
      ]);
    const acquired = Number(acquiredRows?.[0]?.acquired);
    if (acquired !== 1) {
      throw new ServiceUnavailableException(
        'Nu s-a putut verifica limita de abonament. Reîncearcă.',
      );
    }
    try {
      return await fn();
    } finally {
      try {
        await this.connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (error: any) {
        this.logger.warn(
          `RELEASE_LOCK(${lockName}) failed: ${error?.message || error}`,
        );
      }
    }
  }

  async getSupplierLimits(
    companyId: number,
  ): Promise<SupplierSubscriptionLimits> {
    const cid = Number(companyId);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.companiesUrl}/companies/internal/${cid}/subscription`,
          {
            headers: {
              'x-internal-service': 'suppliers',
              'x-service-secret': this.serviceSecret,
            },
            timeout: 5000,
          },
        ),
      );
      const data = response?.data || {};
      const limits = {
        ...DEFAULT_FREE_LIMITS,
        ...(data.limits && typeof data.limits === 'object' ? data.limits : {}),
      };
      return {
        plan_code: String(data?.plan?.code || 'free'),
        plan_name: String(data?.plan?.name || 'Free'),
        status: String(data?.status || 'active'),
        limits,
      };
    } catch (error: any) {
      this.logger.warn(
        `getSupplierLimits company=${cid} failed, falling back to Free: ${error?.message || error}`,
      );
      return {
        plan_code: 'free',
        plan_name: 'Free',
        status: 'active',
        limits: { ...DEFAULT_FREE_LIMITS },
      };
    }
  }

  /**
   * ACCOUNT usage = COUNT(client_supplier_links with quota_status active).
   * `is_active` is operational only — inactive links still occupy a Cont slot.
   * Blocked/removed links do not occupy quota.
   */
  async countAccountSuppliers(companyId: number): Promise<number> {
    return this.clientSupplierLinkRepo.count({
      where: {
        client_company_id: Number(companyId),
        quota_status: SUPPLIER_QUOTA_STATUS.ACTIVE,
      },
    });
  }

  /**
   * MANUAL usage = COUNT DISTINCT Manual suppliers on company locations
   * with quota_status active (missing state row = active).
   */
  async countManualSuppliers(
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

  async getSupplierUsage(
    companyId: number,
    companyLocationIds: number[],
  ): Promise<SupplierUsageSnapshot> {
    const [account_used, manual_used] = await Promise.all([
      this.countAccountSuppliers(companyId),
      this.countManualSuppliers(companyId, companyLocationIds),
    ]);
    return { account_used, manual_used };
  }

  async getSubscriptionUsageView(
    companyId: number,
    companyLocationIds: number[],
  ): Promise<SupplierSubscriptionUsageView> {
    const limits = await this.getSupplierLimits(companyId);
    const usage = await this.getSupplierUsage(companyId, companyLocationIds);
    const account_limit = Number(
      limits.limits[SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX] ?? 1,
    );
    const manual_limit = Number(
      limits.limits[SUPPLIER_LIMIT_KEYS.MANUAL_MAX] ?? 3,
    );
    return {
      ...limits,
      ...usage,
      account_limit,
      manual_limit,
      account_over_limit: usage.account_used > account_limit,
      manual_over_limit: usage.manual_used > manual_limit,
    };
  }

  async assertCanConnectAccountSupplier(
    companyId: number,
  ): Promise<SupplierSubscriptionLimits> {
    const limits = await this.getSupplierLimits(companyId);
    const used = await this.countAccountSuppliers(companyId);
    const limit = Number(
      limits.limits[SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX] ?? 1,
    );
    if (used >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        code: 'SUPPLIER_ACCOUNT_LIMIT_REACHED',
        message:
          'Ai atins limita de furnizori cu cont pentru planul actual.',
        details: {
          limit_key: SUPPLIER_LIMIT_KEYS.ACCOUNT_MAX,
          used,
          limit,
          plan_code: limits.plan_code,
        },
      });
    }
    return limits;
  }

  async assertCanCreateManualSupplier(
    companyId: number,
    companyLocationIds: number[],
  ): Promise<SupplierSubscriptionLimits> {
    const limits = await this.getSupplierLimits(companyId);
    const used = await this.countManualSuppliers(companyId, companyLocationIds);
    const limit = Number(
      limits.limits[SUPPLIER_LIMIT_KEYS.MANUAL_MAX] ?? 3,
    );
    if (used >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        code: 'MANUAL_SUPPLIER_LIMIT_REACHED',
        message:
          'Ai atins limita de furnizori Manual pentru planul actual.',
        details: {
          limit_key: SUPPLIER_LIMIT_KEYS.MANUAL_MAX,
          used,
          limit,
          plan_code: limits.plan_code,
        },
      });
    }
    return limits;
  }
}
