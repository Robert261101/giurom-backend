import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Company } from './entity/company.entity';
import { SubscriptionPlan } from './entity/subscription-plan.entity';
import { PlanLimit } from './entity/plan-limit.entity';
import { PlanFeature } from './entity/plan-feature.entity';
import { CompanySubscription } from './entity/company-subscription.entity';
import { SubscriptionInvoice } from './entity/subscription-invoice.entity';
import {
  DEFAULT_FREE_LIMITS,
  isPlanCode,
  isPlanDowngrade,
  isPlanUpgrade,
  isPlatformSubscriptionAdmin,
  LIMIT_KEYS,
  normalizePlanFeatures,
  normalizePlanLimits,
  pickLimitsForCompanyType,
  PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
  PlanCode,
  getPlanRank,
  resolvePlanGatingMode,
} from './subscription.constants';
import { CompanyAccessRequester } from './company.service';
import {
  applyBillingFieldsOnPlanActivation,
  buildPlanBillingView,
  computeBillingPeriodMetrics,
  toIso,
} from './subscription-billing.util';

export type SubscriptionCompanyType = 'client' | 'furnizor';

export type SubscriptionPlanView = {
  code: string;
  name: string;
  sort_order: number;
  limits: Record<string, number>;
  features: string[];
  price: number | null;
  currency: string | null;
  billing_period: string | null;
  billing_period_days: number | null;
  description: string | null;
  price_configured: boolean;
};

export type CompanySubscriptionView = {
  company_id: number;
  company_type: SubscriptionCompanyType;
  plan: { code: string; name: string };
  status: string;
  limits: Record<string, number>;
  features: string[];
  gating_mode: 'off' | 'log' | 'enforce';
  starts_at?: string | null;
  ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_billing_at?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_method_label?: string | null;
  billing?: {
    price: number | null;
    currency: string | null;
    billing_period: string | null;
    billing_period_days: number | null;
    description: string | null;
    price_configured: boolean;
  };
  period?: {
    days_total: number | null;
    days_elapsed: number | null;
    days_remaining: number | null;
    progress_percent: number | null;
  };
  available_plans?: SubscriptionPlanView[];
};

export type SubscriptionInvoiceView = {
  id: number;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  download_url: string | null;
};

export type SubscriptionInvoicesListView = {
  items: SubscriptionInvoiceView[];
  total: number;
};

export type SubscriptionUsageItem = {
  limit_key: string;
  used: number | null;
  limit: number;
  remaining: number | null;
  reached: boolean;
  over_limit: boolean;
  /** freeze = existing data untouched on downgrade, only new creates blocked; block = legacy supplier flow */
  enforcement: 'freeze' | 'block';
  /** true when the usage source could not be reached (informational only) */
  unavailable?: boolean;
};

export type CompanySubscriptionUsageView = {
  company_id: number;
  company_type: SubscriptionCompanyType;
  plan: { code: string; name: string };
  items: SubscriptionUsageItem[];
};

type RemoteQuotaUsage = {
  account_used?: number;
  manual_used?: number;
  clients_used?: number;
  staff_warehouse_used?: number;
  staff_driver_used?: number;
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly suppliersUrl: string;
  private readonly locationsUrl: string;
  private readonly serviceSecret: string;

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(PlanLimit)
    private readonly planLimitRepo: Repository<PlanLimit>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepo: Repository<CompanySubscription>,
    @InjectRepository(SubscriptionInvoice)
    private readonly invoiceRepo: Repository<SubscriptionInvoice>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(PlanFeature)
    private readonly planFeatureRepo?: Repository<PlanFeature>,
  ) {
    this.suppliersUrl = (
      this.configService.get<string>('SUPPLIERS_HTTP_URL') ||
      process.env.SUPPLIERS_HTTP_URL ||
      'http://localhost:3007'
    ).replace(/\/$/, '');
    this.locationsUrl = (
      this.configService.get<string>('LOCATIONS_HTTP_URL') ||
      process.env.LOCATIONS_HTTP_URL ||
      'http://localhost:3004'
    ).replace(/\/$/, '');
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET ||
      '';
  }

  private normalizeCompanyType(value: unknown): SubscriptionCompanyType | null {
    const raw = String(value ?? '').toLowerCase().trim();
    return raw === 'client' || raw === 'furnizor' ? raw : null;
  }

  private async loadCompanyOrFail(
    companyId: number,
  ): Promise<{ id: number; company_type: SubscriptionCompanyType }> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) {
      throw new BadRequestException('companyId invalid');
    }
    const company = await this.companyRepo.findOne({
      where: { id: cid },
      select: ['id', 'company_type'],
    });
    if (!company) {
      throw new NotFoundException(`Compania ${cid} nu a fost găsită`);
    }
    const companyType = this.normalizeCompanyType(company.company_type);
    if (!companyType) {
      throw new BadRequestException(
        `Compania ${cid} nu are un tip valid (client/furnizor) pentru abonament`,
      );
    }
    return { id: cid, company_type: companyType };
  }

  private async loadPlanFeatures(
    planCode: string,
    companyType: SubscriptionCompanyType,
  ): Promise<string[]> {
    if (!this.planFeatureRepo) return [];
    const rows = await this.planFeatureRepo.find({
      where: { plan_code: planCode, company_type: companyType },
    });
    return normalizePlanFeatures(rows);
  }

  /**
   * Idempotent: ensure a company (client OR furnizor) has an active Free subscription.
   * No-op for missing company.
   */
  async ensureDefaultFreeSubscription(companyId: number): Promise<void> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) return;

    const company = await this.companyRepo.findOne({
      where: { id: cid },
      select: ['id', 'company_type'],
    });
    if (!company || !this.normalizeCompanyType(company.company_type)) return;

    const existing = await this.subscriptionRepo.findOne({
      where: { company_id: cid },
      select: ['id'],
    });
    if (existing) return;

    const free = await this.planRepo.findOne({ where: { code: 'free' } });
    if (!free) {
      console.error(
        `[SubscriptionService] Plan "free" missing — cannot assign company ${cid}`,
      );
      return;
    }

    try {
      const billingFields = applyBillingFieldsOnPlanActivation(free, null);
      await this.subscriptionRepo.save(
        this.subscriptionRepo.create({
          company_id: cid,
          plan_code: 'free',
          status: 'active',
          starts_at: new Date(),
          ends_at: null,
          updated_by_user_id: null,
          ...billingFields,
        }),
      );
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      if (/Duplicate|ER_DUP_ENTRY|UQ_company_subscriptions/i.test(msg)) {
        return;
      }
      throw error;
    }
  }

  private async buildSubscriptionView(
    companyId: number,
    companyType: SubscriptionCompanyType,
    sub: CompanySubscription | null,
    plan: SubscriptionPlan | null,
    limitRows: Array<{ limit_key: string; limit_value: number }>,
    features: string[],
  ): Promise<CompanySubscriptionView> {
    const planCode = plan?.code || sub?.plan_code || 'free';
    const limits = pickLimitsForCompanyType(
      normalizePlanLimits(limitRows),
      companyType,
      PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
    );
    const billing = plan ? buildPlanBillingView(plan) : undefined;
    const period = computeBillingPeriodMetrics(
      sub?.current_period_start ?? sub?.starts_at,
      sub?.current_period_end,
      plan?.billing_period_days,
    );

    return {
      company_id: companyId,
      company_type: companyType,
      plan: {
        code: planCode,
        name: plan?.name || 'Free',
      },
      status: sub?.status || 'active',
      limits,
      features,
      gating_mode: resolvePlanGatingMode(),
      starts_at: toIso(sub?.starts_at),
      ends_at: toIso(sub?.ends_at),
      current_period_start: toIso(sub?.current_period_start),
      current_period_end: toIso(sub?.current_period_end),
      next_billing_at: toIso(sub?.next_billing_at),
      payment_status:
        sub?.payment_status ??
        (billing?.billing_period === 'none' ? 'not_applicable' : null),
      payment_method: sub?.payment_method ?? null,
      payment_method_label: sub?.payment_method_label ?? null,
      billing,
      period,
    };
  }

  async listAvailablePlans(
    companyType: SubscriptionCompanyType = 'client',
  ): Promise<SubscriptionPlanView[]> {
    const plans = await this.planRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
    const result: SubscriptionPlanView[] = [];
    for (const plan of plans) {
      const [limitRows, features] = await Promise.all([
        this.planLimitRepo.find({ where: { plan_code: plan.code } }),
        this.loadPlanFeatures(plan.code, companyType),
      ]);
      const billing = buildPlanBillingView(plan);
      result.push({
        code: plan.code,
        name: plan.name,
        sort_order: plan.sort_order,
        limits: pickLimitsForCompanyType(
          normalizePlanLimits(limitRows),
          companyType,
          PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
        ),
        features,
        price: billing.price,
        currency: billing.currency,
        billing_period: billing.billing_period,
        billing_period_days: billing.billing_period_days,
        description: billing.description,
        price_configured: billing.price_configured,
      });
    }
    return result.sort(
      (a, b) =>
        getPlanRank(a.code) - getPlanRank(b.code) || a.sort_order - b.sort_order,
    );
  }

  /**
   * Canonical plan snapshot for a company (client or furnizor).
   * Consumed by internal endpoint → other MS guards. Features filtered by company type.
   */
  async getSubscriptionForCompany(
    companyId: number,
  ): Promise<CompanySubscriptionView> {
    const company = await this.loadCompanyOrFail(companyId);
    const cid = company.id;

    await this.ensureDefaultFreeSubscription(cid);

    const sub = await this.subscriptionRepo.findOne({
      where: { company_id: cid },
    });
    const planCode = (sub?.plan_code || 'free') as string;
    const plan =
      (await this.planRepo.findOne({ where: { code: planCode } })) ||
      (await this.planRepo.findOne({ where: { code: 'free' } }));

    const effectiveCode = plan?.code || 'free';
    const [limitRows, features] = await Promise.all([
      this.planLimitRepo.find({ where: { plan_code: effectiveCode } }),
      this.loadPlanFeatures(effectiveCode, company.company_type),
    ]);

    return this.buildSubscriptionView(
      cid,
      company.company_type,
      sub,
      plan,
      limitRows,
      features,
    );
  }

  private resolveTenantCompanyIdOrFail(
    requester: CompanyAccessRequester | undefined,
    action: string,
  ): number {
    const companyId = Number(requester?.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        `Doar un tenant autentificat (client sau furnizor) poate ${action}`,
      );
    }
    return companyId;
  }

  async getMySubscription(
    requester?: CompanyAccessRequester,
  ): Promise<CompanySubscriptionView> {
    const companyId = this.resolveTenantCompanyIdOrFail(
      requester,
      'citi abonamentul',
    );
    const view = await this.getSubscriptionForCompany(companyId);
    const availablePlans = await this.listAvailablePlans(view.company_type);
    return { ...view, available_plans: availablePlans };
  }

  async getMyInvoices(
    requester?: CompanyAccessRequester,
  ): Promise<SubscriptionInvoicesListView> {
    const companyId = this.resolveTenantCompanyIdOrFail(
      requester,
      'citi facturile',
    );
    const [items, total] = await this.invoiceRepo.findAndCount({
      where: { company_id: companyId },
      order: { issued_at: 'DESC', id: 'DESC' },
    });
    return {
      total,
      items: items.map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        period_start: toIso(invoice.period_start),
        period_end: toIso(invoice.period_end),
        issued_at: toIso(invoice.issued_at),
        amount: invoice.amount != null ? Number(invoice.amount) : null,
        currency: invoice.currency,
        status: invoice.status,
        download_url: invoice.download_url,
      })),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Usage aggregate (informational; sources: locations-ms, suppliers-ms)   */
  /* ---------------------------------------------------------------------- */

  private internalHeaders() {
    return {
      'x-internal-service': 'company',
      'x-service-secret': this.serviceSecret,
    };
  }

  private async fetchLocationsCount(companyId: number): Promise<number | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.locationsUrl}/locations/internal/companies/${companyId}/count`,
          { headers: this.internalHeaders(), timeout: 5000 },
        ),
      );
      const count = Number(response?.data?.count);
      return Number.isFinite(count) ? count : null;
    } catch (error: any) {
      this.logger.warn(
        `fetchLocationsCount company=${companyId} failed: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async fetchSupplierQuotaUsage(
    companyId: number,
  ): Promise<RemoteQuotaUsage | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/quota-usage`,
          { headers: this.internalHeaders(), timeout: 5000 },
        ),
      );
      return (response?.data || {}) as RemoteQuotaUsage;
    } catch (error: any) {
      this.logger.warn(
        `fetchSupplierQuotaUsage company=${companyId} failed: ${error?.message || error}`,
      );
      return null;
    }
  }

  private buildUsageItem(
    limitKey: string,
    used: number | null | undefined,
    limits: Record<string, number>,
    enforcement: 'freeze' | 'block',
  ): SubscriptionUsageItem {
    const limit = Number(limits[limitKey] ?? DEFAULT_FREE_LIMITS[limitKey] ?? 0);
    const usedNum =
      used == null || !Number.isFinite(Number(used)) ? null : Number(used);
    return {
      limit_key: limitKey,
      used: usedNum,
      limit,
      remaining: usedNum == null ? null : Math.max(0, limit - usedNum),
      reached: usedNum != null && usedNum >= limit,
      over_limit: usedNum != null && usedNum > limit,
      enforcement,
      ...(usedNum == null ? { unavailable: true } : {}),
    };
  }

  /**
   * Aggregated usage vs. limits for the authenticated tenant.
   * client   → account, manual (block flow) + locations (freeze)
   * furnizor → locations, clients, staff warehouse, staff driver (all freeze)
   */
  async getMyUsage(
    requester?: CompanyAccessRequester,
  ): Promise<CompanySubscriptionUsageView> {
    const companyId = this.resolveTenantCompanyIdOrFail(
      requester,
      'citi consumul abonamentului',
    );
    return this.getUsageForCompany(companyId);
  }

  async getUsageForCompany(
    companyId: number,
  ): Promise<CompanySubscriptionUsageView> {
    const view = await this.getSubscriptionForCompany(companyId);
    const [locationsCount, supplierUsage] = await Promise.all([
      this.fetchLocationsCount(view.company_id),
      this.fetchSupplierQuotaUsage(view.company_id),
    ]);

    const items: SubscriptionUsageItem[] = [];
    if (view.company_type === 'client') {
      items.push(
        this.buildUsageItem(
          LIMIT_KEYS.ACCOUNT_MAX,
          supplierUsage?.account_used,
          view.limits,
          'block',
        ),
        this.buildUsageItem(
          LIMIT_KEYS.MANUAL_MAX,
          supplierUsage?.manual_used,
          view.limits,
          'block',
        ),
        this.buildUsageItem(
          LIMIT_KEYS.LOCATIONS_MAX,
          locationsCount,
          view.limits,
          'freeze',
        ),
      );
    } else {
      items.push(
        this.buildUsageItem(
          LIMIT_KEYS.LOCATIONS_MAX,
          locationsCount,
          view.limits,
          'freeze',
        ),
        this.buildUsageItem(
          LIMIT_KEYS.CLIENTS_MAX,
          supplierUsage?.clients_used,
          view.limits,
          'freeze',
        ),
        this.buildUsageItem(
          LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
          supplierUsage?.staff_warehouse_used,
          view.limits,
          'freeze',
        ),
        this.buildUsageItem(
          LIMIT_KEYS.STAFF_DRIVER_MAX,
          supplierUsage?.staff_driver_used,
          view.limits,
          'freeze',
        ),
      );
    }

    return {
      company_id: view.company_id,
      company_type: view.company_type,
      plan: view.plan,
      items,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Plan changes                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Persists an active plan for a company (client or furnizor).
   * Shared by platform admin and self-service upgrade/downgrade.
   * Future payment flow should call this only after successful checkout.
   */
  async activatePlanForCompany(
    companyId: number,
    planCode: PlanCode,
    updatedByUserId?: number | null,
  ): Promise<CompanySubscriptionView> {
    const company = await this.loadCompanyOrFail(companyId);

    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan || !plan.is_active) {
      throw new BadRequestException(`Planul ${planCode} nu este activ`);
    }

    await this.ensureDefaultFreeSubscription(company.id);

    let sub = await this.subscriptionRepo.findOne({
      where: { company_id: company.id },
    });
    const billingFields = applyBillingFieldsOnPlanActivation(plan, sub);
    if (!sub) {
      sub = this.subscriptionRepo.create({
        company_id: company.id,
        plan_code: planCode,
        status: 'active',
        starts_at: new Date(),
        ends_at: null,
        updated_by_user_id: updatedByUserId ?? null,
        ...billingFields,
      });
    } else {
      sub.plan_code = planCode;
      sub.status = 'active';
      sub.ends_at = null;
      sub.updated_by_user_id = updatedByUserId ?? null;
      Object.assign(sub, billingFields);
    }
    await this.subscriptionRepo.save(sub);

    return this.getSubscriptionForCompany(company.id);
  }

  /**
   * Self-service upgrade or downgrade for the authenticated tenant.
   * - client downgrade with surplus of Cont/Manual suppliers requires block
   *   selection in the same request (existing flow, unchanged).
   * - furnizor downgrade with surplus of clients/staff/locations requires
   *   soft-block selection (quota_status=blocked / is_active=0). Upgrade never
   *   auto-reactivates.
   */
  async changeMySubscription(
    requester: CompanyAccessRequester | undefined,
    planCode: string,
    updatedByUserId?: number | null,
    options?: {
      block_account_supplier_ids?: number[];
      block_manual_supplier_ids?: number[];
      block_client_company_ids?: number[];
      block_staff_warehouse_employee_ids?: number[];
      block_staff_driver_employee_ids?: number[];
      block_location_ids?: number[];
    },
  ): Promise<CompanySubscriptionView> {
    const companyId = this.resolveTenantCompanyIdOrFail(
      requester,
      'schimba planul',
    );
    if (!isPlanCode(planCode)) {
      throw new BadRequestException(
        'Plan invalid. Valori acceptate: free, silver, gold',
      );
    }

    const current = await this.getSubscriptionForCompany(companyId);
    const rawCurrent = String(current.plan.code || 'free').toLowerCase().trim();
    const currentCode = (isPlanCode(rawCurrent) ? rawCurrent : 'free') as PlanCode;
    if (currentCode === planCode) {
      const availablePlans = await this.listAvailablePlans(current.company_type);
      return { ...current, available_plans: availablePlans };
    }
    if (
      !isPlanUpgrade(currentCode, planCode) &&
      !isPlanDowngrade(currentCode, planCode)
    ) {
      throw new BadRequestException(
        'Plan invalid. Valori acceptate: free, silver, gold',
      );
    }

    if (isPlanDowngrade(currentCode, planCode) && current.company_type === 'client') {
      const result = await this.changeMySubscriptionWithDowngradeGuards(
        companyId,
        planCode,
        updatedByUserId ?? null,
        options,
      );
      const availablePlans = await this.listAvailablePlans('client');
      return { ...result, available_plans: availablePlans };
    }

    if (
      isPlanDowngrade(currentCode, planCode) &&
      current.company_type === 'furnizor'
    ) {
      const result = await this.changeMySubscriptionWithFurnizorDowngradeGuards(
        companyId,
        planCode,
        updatedByUserId ?? null,
        options,
      );
      const availablePlans = await this.listAvailablePlans('furnizor');
      return { ...result, available_plans: availablePlans };
    }

    const activated = await this.activatePlanForCompany(
      companyId,
      planCode,
      updatedByUserId ?? null,
    );
    const availablePlans = await this.listAvailablePlans(current.company_type);
    return { ...activated, available_plans: availablePlans };
  }

  private async getPlanLimits(planCode: PlanCode): Promise<Record<string, number>> {
    const limitRows = await this.planLimitRepo.find({
      where: { plan_code: planCode },
    });
    return normalizePlanLimits(limitRows);
  }

  private async fetchDowngradePreview(
    companyId: number,
    planCode: PlanCode,
    limits: Record<string, number>,
  ) {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/downgrade-preview`,
        {
          headers: this.internalHeaders(),
          params: {
            plan_code: planCode,
            account_limit: limits[LIMIT_KEYS.ACCOUNT_MAX],
            manual_limit: limits[LIMIT_KEYS.MANUAL_MAX],
          },
          timeout: 10000,
        },
      ),
    );
    return response?.data;
  }

  private async applyDowngradeBlocks(
    companyId: number,
    planCode: PlanCode,
    limits: Record<string, number>,
    blockAccountIds: number[],
    blockManualIds: number[],
  ) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/apply-downgrade-blocks`,
        {
          plan_code: planCode,
          account_limit: limits[LIMIT_KEYS.ACCOUNT_MAX],
          manual_limit: limits[LIMIT_KEYS.MANUAL_MAX],
          block_account_supplier_ids: blockAccountIds,
          block_manual_supplier_ids: blockManualIds,
        },
        {
          headers: this.internalHeaders(),
          timeout: 15000,
        },
      ),
    );
    return response?.data;
  }

  private async rollbackDowngradeBlocks(
    companyId: number,
    rollbackItems: unknown[],
  ): Promise<void> {
    if (!rollbackItems?.length) return;
    await firstValueFrom(
      this.httpService.post(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/rollback-downgrade-blocks`,
        { rollback_items: rollbackItems },
        {
          headers: this.internalHeaders(),
          timeout: 10000,
        },
      ),
    );
  }

  private async changeMySubscriptionWithDowngradeGuards(
    companyId: number,
    planCode: PlanCode,
    updatedByUserId: number | null,
    options?: {
      block_account_supplier_ids?: number[];
      block_manual_supplier_ids?: number[];
    },
  ): Promise<CompanySubscriptionView> {
    const limits = await this.getPlanLimits(planCode);
    const preview = await this.fetchDowngradePreview(companyId, planCode, limits);
    const blockAccountIds = (options?.block_account_supplier_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const blockManualIds = (options?.block_manual_supplier_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);

    if (preview?.requires_blocks) {
      const accountMinimum = Number(preview?.account?.minimum_to_block || 0);
      const manualMinimum = Number(preview?.manual?.minimum_to_block || 0);
      const accountOk =
        accountMinimum === 0 || blockAccountIds.length >= accountMinimum;
      const manualOk =
        manualMinimum === 0 || blockManualIds.length >= manualMinimum;
      if (!accountOk || !manualOk) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'DOWNGRADE_REQUIRES_BLOCKS',
          message:
            'Downgrade-ul necesită selectarea furnizorilor care vor fi blocați.',
          details: preview,
        });
      }
    }

    let rollbackItems: unknown[] = [];
    if (preview?.requires_blocks) {
      const applyResult = await this.applyDowngradeBlocks(
        companyId,
        planCode,
        limits,
        blockAccountIds,
        blockManualIds,
      );
      rollbackItems = applyResult?.rollback_items || [];
    }

    try {
      return await this.activatePlanForCompany(
        companyId,
        planCode,
        updatedByUserId,
      );
    } catch (error) {
      try {
        await this.rollbackDowngradeBlocks(companyId, rollbackItems);
      } catch (rollbackError: any) {
        this.logger.error(
          `Rollback downgrade blocks failed company=${companyId}: ${rollbackError?.message || rollbackError}`,
        );
      }
      throw error;
    }
  }

  private async fetchFurnizorDowngradePreview(
    companyId: number,
    planCode: PlanCode,
    limits: Record<string, number>,
  ) {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/furnizor-downgrade-preview`,
        {
          headers: this.internalHeaders(),
          params: {
            plan_code: planCode,
            clients_limit: limits[LIMIT_KEYS.CLIENTS_MAX],
            warehouse_limit: limits[LIMIT_KEYS.STAFF_WAREHOUSE_MAX],
            driver_limit: limits[LIMIT_KEYS.STAFF_DRIVER_MAX],
            location_limit: limits[LIMIT_KEYS.LOCATIONS_MAX],
          },
          timeout: 15000,
        },
      ),
    );
    return response?.data;
  }

  private async applyFurnizorSupplierBlocks(
    companyId: number,
    limits: Record<string, number>,
    blockClientIds: number[],
    blockWarehouseIds: number[],
    blockDriverIds: number[],
  ) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/apply-furnizor-downgrade-blocks`,
        {
          clients_limit: limits[LIMIT_KEYS.CLIENTS_MAX],
          warehouse_limit: limits[LIMIT_KEYS.STAFF_WAREHOUSE_MAX],
          driver_limit: limits[LIMIT_KEYS.STAFF_DRIVER_MAX],
          block_client_company_ids: blockClientIds,
          block_staff_warehouse_employee_ids: blockWarehouseIds,
          block_staff_driver_employee_ids: blockDriverIds,
        },
        {
          headers: this.internalHeaders(),
          timeout: 20000,
        },
      ),
    );
    return response?.data;
  }

  private async rollbackFurnizorSupplierBlocks(
    companyId: number,
    rollbackItems: unknown[],
  ): Promise<void> {
    if (!rollbackItems?.length) return;
    await firstValueFrom(
      this.httpService.post(
        `${this.suppliersUrl}/suppliers/internal/companies/${companyId}/subscription/rollback-furnizor-downgrade-blocks`,
        { rollback_items: rollbackItems },
        {
          headers: this.internalHeaders(),
          timeout: 15000,
        },
      ),
    );
  }

  private async applyLocationDowngradeBlocks(
    companyId: number,
    locationLimit: number,
    blockLocationIds: number[],
  ) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.locationsUrl}/locations/internal/companies/${companyId}/subscription/apply-downgrade-blocks`,
        {
          location_limit: locationLimit,
          block_location_ids: blockLocationIds,
        },
        {
          headers: this.internalHeaders(),
          timeout: 15000,
        },
      ),
    );
    return response?.data;
  }

  private async rollbackLocationDowngradeBlocks(
    companyId: number,
    rollbackItems: unknown[],
  ): Promise<void> {
    if (!rollbackItems?.length) return;
    await firstValueFrom(
      this.httpService.post(
        `${this.locationsUrl}/locations/internal/companies/${companyId}/subscription/rollback-downgrade-blocks`,
        { rollback_items: rollbackItems },
        {
          headers: this.internalHeaders(),
          timeout: 10000,
        },
      ),
    );
  }

  private async changeMySubscriptionWithFurnizorDowngradeGuards(
    companyId: number,
    planCode: PlanCode,
    updatedByUserId: number | null,
    options?: {
      block_client_company_ids?: number[];
      block_staff_warehouse_employee_ids?: number[];
      block_staff_driver_employee_ids?: number[];
      block_location_ids?: number[];
    },
  ): Promise<CompanySubscriptionView> {
    const limits = await this.getPlanLimits(planCode);
    const preview = await this.fetchFurnizorDowngradePreview(
      companyId,
      planCode,
      limits,
    );
    const blockClientIds = (options?.block_client_company_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const blockWarehouseIds = (options?.block_staff_warehouse_employee_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const blockDriverIds = (options?.block_staff_driver_employee_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
    const blockLocationIds = (options?.block_location_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);

    if (preview?.requires_blocks) {
      const clientsMin = Number(preview?.clients?.minimum_to_block || 0);
      const warehouseMin = Number(
        preview?.staff_warehouse?.minimum_to_block || 0,
      );
      const driversMin = Number(preview?.staff_driver?.minimum_to_block || 0);
      const locationsMin = Number(preview?.locations?.minimum_to_block || 0);
      const ok =
        (clientsMin === 0 || blockClientIds.length >= clientsMin) &&
        (warehouseMin === 0 || blockWarehouseIds.length >= warehouseMin) &&
        (driversMin === 0 || blockDriverIds.length >= driversMin) &&
        (locationsMin === 0 || blockLocationIds.length >= locationsMin);
      if (!ok) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'DOWNGRADE_REQUIRES_BLOCKS',
          message:
            'Downgrade-ul necesită selectarea resurselor care vor fi blocate.',
          details: preview,
        });
      }
    }

    let supplierRollback: unknown[] = [];
    let locationRollback: unknown[] = [];
    const needsSupplierBlocks =
      Number(preview?.clients?.minimum_to_block || 0) > 0 ||
      Number(preview?.staff_warehouse?.minimum_to_block || 0) > 0 ||
      Number(preview?.staff_driver?.minimum_to_block || 0) > 0 ||
      blockClientIds.length > 0 ||
      blockWarehouseIds.length > 0 ||
      blockDriverIds.length > 0;
    const needsLocationBlocks =
      Number(preview?.locations?.minimum_to_block || 0) > 0 ||
      blockLocationIds.length > 0;

    try {
      if (needsSupplierBlocks) {
        const applyResult = await this.applyFurnizorSupplierBlocks(
          companyId,
          limits,
          blockClientIds,
          blockWarehouseIds,
          blockDriverIds,
        );
        supplierRollback = applyResult?.rollback_items || [];
      }
      if (needsLocationBlocks) {
        const applyLoc = await this.applyLocationDowngradeBlocks(
          companyId,
          Number(limits[LIMIT_KEYS.LOCATIONS_MAX] || 0),
          blockLocationIds,
        );
        locationRollback = applyLoc?.rollback_items || [];
      }
      return await this.activatePlanForCompany(
        companyId,
        planCode,
        updatedByUserId,
      );
    } catch (error) {
      try {
        await this.rollbackLocationDowngradeBlocks(companyId, locationRollback);
      } catch (rollbackError: any) {
        this.logger.error(
          `Rollback location downgrade blocks failed company=${companyId}: ${rollbackError?.message || rollbackError}`,
        );
      }
      try {
        await this.rollbackFurnizorSupplierBlocks(companyId, supplierRollback);
      } catch (rollbackError: any) {
        this.logger.error(
          `Rollback furnizor downgrade blocks failed company=${companyId}: ${rollbackError?.message || rollbackError}`,
        );
      }
      throw error;
    }
  }

  /**
   * Informational downgrade preview for freeze-create quotas: what would be
   * over the new limit (nothing gets disabled). Client keeps the supplier
   * block preview from suppliers-ms in addition (existing FE call).
   * Furnizor forced-block preview is served by suppliers
   * `/me/subscription/furnizor-downgrade-preview`.
   */
  async previewMyDowngrade(
    requester: CompanyAccessRequester | undefined,
    planCode: string,
  ): Promise<{
    company_type: SubscriptionCompanyType;
    current_plan: string;
    target_plan: string;
    is_downgrade: boolean;
    frozen_usage: SubscriptionUsageItem[];
  }> {
    const companyId = this.resolveTenantCompanyIdOrFail(
      requester,
      'previzualiza schimbarea planului',
    );
    if (!isPlanCode(planCode)) {
      throw new BadRequestException(
        'Plan invalid. Valori acceptate: free, silver, gold',
      );
    }
    const usage = await this.getUsageForCompany(companyId);
    const targetLimits = pickLimitsForCompanyType(
      await this.getPlanLimits(planCode),
      usage.company_type,
      PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
    );
    const frozen = usage.items
      .filter((item) => item.enforcement === 'freeze')
      .map((item) =>
        this.buildUsageItem(item.limit_key, item.used, targetLimits, 'freeze'),
      );
    return {
      company_type: usage.company_type,
      current_plan: usage.plan.code,
      target_plan: planCode,
      is_downgrade: isPlanDowngrade(usage.plan.code, planCode),
      frozen_usage: frozen,
    };
  }

  /**
   * Platform-only plan change. Never deletes data.
   * Downgrade may leave usage over limit — only future creates are blocked.
   */
  async setCompanyPlan(
    companyId: number,
    planCode: string,
    requester?: CompanyAccessRequester,
    updatedByUserId?: number | null,
  ): Promise<CompanySubscriptionView> {
    if (!isPlatformSubscriptionAdmin(requester)) {
      throw new ForbiddenException(
        'Doar platform admin poate schimba planul unei companii',
      );
    }
    if (!isPlanCode(planCode)) {
      throw new BadRequestException(
        `Plan invalid. Valori acceptate: free, silver, gold`,
      );
    }

    return this.activatePlanForCompany(
      companyId,
      planCode,
      updatedByUserId ?? null,
    );
  }

  /** Fallback Free view when tables empty (tests / broken seed). */
  freeFallbackView(
    companyId = 0,
    companyType: SubscriptionCompanyType = 'client',
  ): CompanySubscriptionView {
    return {
      company_id: companyId,
      company_type: companyType,
      plan: { code: 'free', name: 'Free' },
      status: 'active',
      limits: pickLimitsForCompanyType(
        { ...DEFAULT_FREE_LIMITS },
        companyType,
        PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
      ),
      features: [],
      gating_mode: resolvePlanGatingMode(),
      starts_at: null,
      ends_at: null,
    };
  }
}
