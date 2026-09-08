/**
 * NestJS adapter over `@giurom/tenant-access` plan helpers.
 * Kept per-microservice (thin) so the shared lib stays framework-agnostic.
 *
 * - `@RequiresPlanFeature('pontaj')` + `PlanFeatureGuard` → 403 PLAN_FEATURE_DENIED
 *   (FAIL-CLOSED: unresolved company / company-ms down → 403/503, no Free fallback).
 * - `PlanAccessService.assertLimitForCompany` → freeze-create quota check.
 * - Soft-launch: PLAN_GATING_MODE=off|log|enforce (default enforce).
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CompanyPlanClient,
  CompanyPlanSnapshot,
  createCompanyPlanClient,
  evaluatePlanFeatureAccess,
  evaluatePlanLimitForCompany,
  isPlanAccessError,
  PlanLimitCheck,
  resolvePlanGatingMode,
} from '@giurom/tenant-access';

export const PLAN_FEATURE_METADATA_KEY = 'giurom:plan_feature_key';

/** Declares the subscription feature required by a route (checked after RBAC). */
export const RequiresPlanFeature = (featureKey: string) =>
  SetMetadata(PLAN_FEATURE_METADATA_KEY, featureKey);

/** Maps a `PlanAccessError` to the HTTP exception carrying its canonical body; null otherwise. */
export function planAccessErrorToHttp(error: unknown): HttpException | null {
  if (!isPlanAccessError(error)) return null;
  const body = error.toHttpBody();
  return error.httpStatus === 503
    ? new ServiceUnavailableException(body)
    : new ForbiddenException(body);
}

@Injectable()
export class PlanAccessService {
  private readonly logger = new Logger(PlanAccessService.name);
  readonly client: CompanyPlanClient;

  constructor() {
    this.client = createCompanyPlanClient({
      companiesUrl:
        process.env.COMPANIES_HTTP_URL ||
        process.env.COMPANY_HTTP_URL ||
        'http://localhost:3003',
      serviceSecret: process.env.SERVICE_SECRET || '',
      serviceName: process.env.PLAN_ACCESS_SERVICE_NAME || 'tasks',
      cacheTtlMs: Number(process.env.PLAN_CACHE_TTL_MS || 15000),
      logger: { warn: (msg) => this.logger.warn(msg) },
    });
  }

  get mode() {
    return resolvePlanGatingMode();
  }

  async getCompanyPlan(companyId: number): Promise<CompanyPlanSnapshot> {
    try {
      return await this.client.getCompanyPlan(companyId);
    } catch (error) {
      throw planAccessErrorToHttp(error) ?? error;
    }
  }

  /**
   * Freeze-create gate on the TARGET company. Throws 403 SUBSCRIPTION_LIMIT_REACHED
   * (with `code`) when `used >= limit`; 503 when the plan cannot be resolved.
   */
  async assertLimitForCompany(
    companyId: number,
    limitKey: string,
    countUsed: () => Promise<number>,
    options?: { code?: string; message?: string },
  ): Promise<{ snapshot: CompanyPlanSnapshot; check: PlanLimitCheck } | null> {
    try {
      const result = await evaluatePlanLimitForCompany(
        this.client,
        companyId,
        limitKey,
        countUsed,
        { ...options, mode: this.mode },
      );
      if (result && this.mode === 'log' && result.check.reached) {
        this.logger.warn(
          `[plan-gating:log] limit ${limitKey} reached company=${companyId} used=${result.check.used} limit=${result.check.limit}`,
        );
      }
      return result;
    } catch (error) {
      throw planAccessErrorToHttp(error) ?? error;
    }
  }
}

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  private readonly logger = new Logger(PlanFeatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly planAccess: PlanAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string | undefined>(
      PLAN_FEATURE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest();
    // Internal service-to-service calls (secret already validated by the auth guards)
    // are exempt; the flag name differs per MS (bypassAuth vs internalService).
    const isInternalCall =
      request?.bypassAuth === true || Boolean(request?.internalService);
    const user = isInternalCall ? { bypassAuth: true } : (request?.user ?? null);

    const result = await evaluatePlanFeatureAccess(
      this.planAccess.client,
      user,
      featureKey,
      this.planAccess.mode,
    );
    if (result.allowed === false) {
      throw planAccessErrorToHttp(result.error) ?? new ForbiddenException();
    }
    if (result.reason === 'log_only') {
      this.logger.warn(
        `[plan-gating:log] feature "${featureKey}" would be denied for company=${user?.company_id ?? user?.companyId ?? 'n/a'}`,
      );
    }
    return true;
  }
}
