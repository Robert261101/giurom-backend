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
import { CompanySubscription } from './entity/company-subscription.entity';
import { SubscriptionInvoice } from './entity/subscription-invoice.entity';
import {
  DEFAULT_FREE_LIMITS,
  isPlanCode,
  isPlanDowngrade,
  isPlanUpgrade,
  isPlatformSubscriptionAdmin,
  LIMIT_KEYS,
  normalizePlanLimits,
  PlanCode,
  getPlanRank,
} from './subscription.constants';
import { CompanyAccessRequester } from './company.service';
import {
  applyBillingFieldsOnPlanActivation,
  buildPlanBillingView,
  computeBillingPeriodMetrics,
  toIso,
} from './subscription-billing.util';

export type SubscriptionPlanView = {
  code: string;
  name: string;
  sort_order: number;
  limits: Record<string, number>;
  price: number | null;
  currency: string | null;
  billing_period: string | null;
  billing_period_days: number | null;
  description: string | null;
  price_configured: boolean;
};

export type CompanySubscriptionView = {
  plan: { code: string; name: string };
  status: string;
  limits: Record<string, number>;
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

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly suppliersUrl: string;
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
  ) {
    this.suppliersUrl = (
      this.configService.get<string>('SUPPLIERS_HTTP_URL') ||
      process.env.SUPPLIERS_HTTP_URL ||
      'http://localhost:3007'
    ).replace(/\/$/, '');
    this.serviceSecret =
      this.configService.get<string>('SERVICE_SECRET') ||
      process.env.SERVICE_SECRET ||
      '';
  }

  /**
   * Idempotent: ensure a client company has an active Free subscription.
   * No-op for furnizor or missing company.
   */
  async ensureDefaultFreeSubscription(companyId: number): Promise<void> {
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid <= 0) return;

    const company = await this.companyRepo.findOne({
      where: { id: cid },
      select: ['id', 'company_type'],
    });
    if (!company || company.company_type !== 'client') return;

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
    sub: CompanySubscription | null,
    plan: SubscriptionPlan | null,
    limitRows: Array<{ limit_key: string; limit_value: number }>,
  ): Promise<CompanySubscriptionView> {
    const planCode = plan?.code || sub?.plan_code || 'free';
    const limits = normalizePlanLimits(limitRows);
    const billing = plan ? buildPlanBillingView(plan) : undefined;
    const period = computeBillingPeriodMetrics(
      sub?.current_period_start ?? sub?.starts_at,
      sub?.current_period_end,
      plan?.billing_period_days,
    );

    return {
      plan: {
        code: planCode,
        name: plan?.name || 'Free',
      },
      status: sub?.status || 'active',
      limits,
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

  async listAvailablePlans(): Promise<SubscriptionPlanView[]> {
    const plans = await this.planRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC' },
    });
    const result: SubscriptionPlanView[] = [];
    for (const plan of plans) {
      const limitRows = await this.planLimitRepo.find({
        where: { plan_code: plan.code },
      });
      const billing = buildPlanBillingView(plan);
      result.push({
        code: plan.code,
        name: plan.name,
        sort_order: plan.sort_order,
        limits: normalizePlanLimits(limitRows),
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

  async getSubscriptionForCompany(
    companyId: number,
  ): Promise<CompanySubscriptionView> {
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
    if (company.company_type !== 'client') {
      throw new BadRequestException(
        'Abonamentul client se aplică doar companiilor de tip client',
      );
    }

    await this.ensureDefaultFreeSubscription(cid);

    const sub = await this.subscriptionRepo.findOne({
      where: { company_id: cid },
    });
    const planCode = (sub?.plan_code || 'free') as string;
    const plan =
      (await this.planRepo.findOne({ where: { code: planCode } })) ||
      (await this.planRepo.findOne({ where: { code: 'free' } }));

    const limitRows = await this.planLimitRepo.find({
      where: { plan_code: plan?.code || 'free' },
    });

    return this.buildSubscriptionView(sub, plan, limitRows);
  }

  async getMySubscription(
    requester?: CompanyAccessRequester,
  ): Promise<CompanySubscriptionView> {
    const companyId = Number(requester?.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate citi abonamentul',
      );
    }
    if (requester?.companyType === 'furnizor') {
      throw new ForbiddenException(
        'Abonamentul client nu este disponibil pentru conturi furnizor',
      );
    }
    const [view, availablePlans] = await Promise.all([
      this.getSubscriptionForCompany(companyId),
      this.listAvailablePlans(),
    ]);
    return { ...view, available_plans: availablePlans };
  }

  async getMyInvoices(
    requester?: CompanyAccessRequester,
  ): Promise<SubscriptionInvoicesListView> {
    const companyId = Number(requester?.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate citi facturile',
      );
    }
    if (requester?.companyType === 'furnizor') {
      throw new ForbiddenException(
        'Facturile client nu sunt disponibile pentru conturi furnizor',
      );
    }
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

  /**
   * Persists an active plan for a client company.
   * Shared by platform admin and (temporary) self-service upgrade/downgrade.
   * Future payment flow should call this only after successful checkout.
   */
  async activatePlanForCompany(
    companyId: number,
    planCode: PlanCode,
    updatedByUserId?: number | null,
  ): Promise<CompanySubscriptionView> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      select: ['id', 'company_type'],
    });
    if (!company) {
      throw new NotFoundException(`Compania ${companyId} nu a fost găsită`);
    }
    if (company.company_type !== 'client') {
      throw new BadRequestException(
        'Planul se aplică doar companiilor client',
      );
    }

    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan || !plan.is_active) {
      throw new BadRequestException(`Planul ${planCode} nu este activ`);
    }

    await this.ensureDefaultFreeSubscription(companyId);

    let sub = await this.subscriptionRepo.findOne({
      where: { company_id: companyId },
    });
    const billingFields = applyBillingFieldsOnPlanActivation(plan, sub);
    if (!sub) {
      sub = this.subscriptionRepo.create({
        company_id: companyId,
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

    return this.getSubscriptionForCompany(companyId);
  }

  /**
   * Self-service upgrade or downgrade for authenticated client tenant.
   * Downgrade with surplus requires supplier block selection in the same request.
   */
  async changeMySubscription(
    requester: CompanyAccessRequester | undefined,
    planCode: string,
    updatedByUserId?: number | null,
    options?: {
      block_account_supplier_ids?: number[];
      block_manual_supplier_ids?: number[];
    },
  ): Promise<CompanySubscriptionView> {
    const companyId = Number(requester?.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        'Doar un tenant client autentificat poate schimba planul',
      );
    }
    if (requester?.companyType === 'furnizor') {
      throw new ForbiddenException(
        'Abonamentul client nu este disponibil pentru conturi furnizor',
      );
    }
    if (!isPlanCode(planCode)) {
      throw new BadRequestException(
        'Plan invalid. Valori acceptate: free, silver, gold',
      );
    }

    const current = await this.getSubscriptionForCompany(companyId);
    const rawCurrent = String(current.plan.code || 'free').toLowerCase().trim();
    const currentCode = (isPlanCode(rawCurrent) ? rawCurrent : 'free') as PlanCode;
    if (currentCode === planCode) {
      const [view, availablePlans] = await Promise.all([
        this.getSubscriptionForCompany(companyId),
        this.listAvailablePlans(),
      ]);
      return { ...view, available_plans: availablePlans };
    }
    if (
      !isPlanUpgrade(currentCode, planCode) &&
      !isPlanDowngrade(currentCode, planCode)
    ) {
      throw new BadRequestException(
        'Plan invalid. Valori acceptate: free, silver, gold',
      );
    }

    if (isPlanDowngrade(currentCode, planCode)) {
      const result = await this.changeMySubscriptionWithDowngradeGuards(
        companyId,
        planCode,
        updatedByUserId ?? null,
        options,
      );
      const availablePlans = await this.listAvailablePlans();
      return { ...result, available_plans: availablePlans };
    }

    const activated = await this.activatePlanForCompany(
      companyId,
      planCode,
      updatedByUserId ?? null,
    );
    const availablePlans = await this.listAvailablePlans();
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
          headers: {
            'x-internal-service': 'company',
            'x-service-secret': this.serviceSecret,
          },
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
          headers: {
            'x-internal-service': 'company',
            'x-service-secret': this.serviceSecret,
          },
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
          headers: {
            'x-internal-service': 'company',
            'x-service-secret': this.serviceSecret,
          },
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

  /**
   * Platform-only plan change. Never deletes supplier data.
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
  freeFallbackView(): CompanySubscriptionView {
    return {
      plan: { code: 'free', name: 'Free' },
      status: 'active',
      limits: { ...DEFAULT_FREE_LIMITS },
      starts_at: null,
      ends_at: null,
    };
  }
}
