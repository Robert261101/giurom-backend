/**
 * In-process plan feature gate for company-ms (no HTTP round-trip: the plan
 * source of truth lives in this service). Same semantics as the per-MS adapters:
 * `@RequiresPlanFeature('firme')` + `PlanFeatureGuard` → 403 PLAN_FEATURE_DENIED,
 * FAIL-CLOSED when the company cannot be resolved, internal calls exempt,
 * PLAN_GATING_MODE=off|log|enforce honoured.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CompanyPlanClient,
  CompanyPlanSnapshot,
  evaluatePlanFeatureAccess,
  isPlanAccessError,
  normalizeCompanyPlanSnapshot,
  resolvePlanGatingMode,
} from '@giurom/tenant-access';
import { SubscriptionService } from '../company/subscription.service';

export const PLAN_FEATURE_METADATA_KEY = 'giurom:plan_feature_key';

export const RequiresPlanFeature = (featureKey: string) =>
  SetMetadata(PLAN_FEATURE_METADATA_KEY, featureKey);

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  private readonly logger = new Logger(PlanFeatureGuard.name);
  private readonly client: CompanyPlanClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {
    const service = this.subscriptionService;
    this.client = {
      async getCompanyPlan(companyId: number): Promise<CompanyPlanSnapshot> {
        const view = await service.getSubscriptionForCompany(companyId);
        return normalizeCompanyPlanSnapshot(companyId, view);
      },
      invalidate() {
        /* no cache in-process */
      },
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string | undefined>(
      PLAN_FEATURE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest();
    const isInternalCall =
      request?.bypassAuth === true || Boolean(request?.internalService);
    const user = isInternalCall ? { bypassAuth: true } : (request?.user ?? null);

    const mode = resolvePlanGatingMode();
    const result = await evaluatePlanFeatureAccess(
      this.client,
      user,
      featureKey,
      mode,
    );
    if (result.allowed === false) {
      const body = isPlanAccessError(result.error)
        ? result.error.toHttpBody()
        : undefined;
      if (result.error?.httpStatus === 503) {
        throw new ServiceUnavailableException(body);
      }
      throw new ForbiddenException(body);
    }
    if (result.reason === 'log_only') {
      this.logger.warn(
        `[plan-gating:log] feature "${featureKey}" would be denied for company=${user?.company_id ?? user?.companyId ?? 'n/a'}`,
      );
    }
    return true;
  }
}
