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
import {
  DEFAULT_FREE_LIMITS,
  isPlanCode,
  isPlanDowngrade,
  isPlanUpgrade,
  isPlatformSubscriptionAdmin,
  LIMIT_KEYS,
  normalizePlanLimits,
  PlanCode,
} from './subscription.constants';
import { CompanyAccessRequester } from './company.service';

export type CompanySubscriptionView = {
  plan: { code: string; name: string };
  status: string;
  limits: Record<string, number>;
  starts_at?: string | null;
  ends_at?: string | null;
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
      await this.subscriptionRepo.save(
        this.subscriptionRepo.create({
          company_id: cid,
          plan_code: 'free',
          status: 'active',
          starts_at: new Date(),
          ends_at: null,
          updated_by_user_id: null,
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

    return {
      plan: {
        code: plan?.code || 'free',
        name: plan?.name || 'Free',
      },
      status: sub?.status || 'active',
      limits: normalizePlanLimits(limitRows),
      starts_at: sub?.starts_at ? sub.starts_at.toISOString() : null,
      ends_at: sub?.ends_at ? sub.ends_at.toISOString() : null,
    };
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
    return this.getSubscriptionForCompany(companyId);
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
    if (!sub) {
      sub = this.subscriptionRepo.create({
        company_id: companyId,
        plan_code: planCode,
        status: 'active',
        starts_at: new Date(),
        ends_at: null,
        updated_by_user_id: updatedByUserId ?? null,
      });
    } else {
      sub.plan_code = planCode;
      sub.status = 'active';
      sub.ends_at = null;
      sub.updated_by_user_id = updatedByUserId ?? null;
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
      return current;
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
      return this.changeMySubscriptionWithDowngradeGuards(
        companyId,
        planCode,
        updatedByUserId ?? null,
        options,
      );
    }

    return this.activatePlanForCompany(
      companyId,
      planCode,
      updatedByUserId ?? null,
    );
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
