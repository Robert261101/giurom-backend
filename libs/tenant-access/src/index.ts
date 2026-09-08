export type {
  PlatformSubscriptionAdminRequester,
  TenantAccessUser,
} from './tenant-access.types';

export { TenantScopeViolationError } from './tenant-access.errors';

export type {
  CompanyPlanClient,
  CompanyPlanClientOptions,
  CompanyPlanSnapshot,
  PlanAccessErrorBody,
  PlanAccessErrorCode,
  PlanCompanyType,
  PlanFeatureEvaluation,
  PlanFeatureKey,
  PlanFetchImpl,
  PlanFetchResponse,
  PlanGatingMode,
  PlanLimitCheck,
  PlanLimitKey,
} from './plan-access';

export {
  FREEZE_LIMIT_KEYS,
  PLAN_ACCESS_ERROR_CODES,
  PLAN_COMPANY_TYPES,
  PLAN_FEATURE_KEYS,
  PLAN_LIMIT_KEYS,
  PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
  PlanAccessError,
  assertPlanFeature,
  assertPlanLimit,
  createCompanyPlanClient,
  describePlanLimit,
  evaluatePlanFeatureAccess,
  evaluatePlanLimitForCompany,
  getPlanLimit,
  hasPlanFeature,
  isPlanAccessError,
  isPlanFeatureKey,
  isPlanGateExempt,
  normalizeCompanyPlanSnapshot,
  resolvePlanCompanyIdOrFail,
  resolvePlanGatingMode,
} from './plan-access';

export {
  assertTenantCompanyId,
  hasPlatformWideAccess,
  hasPlatformWideSupplierAccess,
  isPlatformSubscriptionAdmin,
  isTenantScopedRequester,
  isTenantScopedSupplierRequester,
  resolveJwtCompanyId,
} from './tenant-access';
