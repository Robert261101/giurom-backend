/**
 * Minimal JWT / requester shape shared across microservices.
 * Supports both snake_case and camelCase company id fields.
 */
export type TenantAccessUser = {
  company_id?: number | null;
  companyId?: number | null;
  isSuperAdmin?: boolean;
  permissions?: string[];
  roles?: string[];
  /** Internal service bypass — not platform-wide by itself; handled at call sites in PR-1.1+. */
  bypassAuth?: boolean;
};

/**
 * Requester shape for subscription/billing platform checks (company-ms).
 * Extends tenant fields so `resolveJwtCompanyId` applies uniformly.
 *
 * `hasPlatformWideAccess` is accepted when precomputed by `buildAccessRequester`
 * (company.http.controller) but is ignored when a tenant company id is bound.
 */
export type PlatformSubscriptionAdminRequester = TenantAccessUser & {
  isSuperAdmin?: boolean;
  hasPlatformWideAccess?: boolean;
};
