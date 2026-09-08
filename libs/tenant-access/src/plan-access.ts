/**
 * Plan access (subscription features + numeric limits) — shared across
 * microservices. Framework-agnostic: no NestJS imports; each MS maps
 * `PlanAccessError` to its HTTP layer (see `toHttpBody()`).
 *
 * Business rules (confirmed 2026-09-07):
 * - Access = RBAC ∩ plan features. Plan is resolved by the requester's
 *   company_id (employee inherits the company plan).
 * - FAIL-CLOSED: if company_id cannot be resolved canonically, or company-ms
 *   cannot be reached, gated features are denied (no fallback to Free).
 * - New quotas (locations/clients/staff) are FREEZE-CREATE / FREEZE-ASSIGN:
 *   `used >= limit` blocks new creates/assignments; existing data is untouched.
 * - `suppliers.account.max` / `suppliers.manual.max` keep their existing flow.
 */
import { hasPlatformWideAccess, resolveJwtCompanyId } from './tenant-access';
import type { TenantAccessUser } from './tenant-access.types';

export const PLAN_COMPANY_TYPES = ['client', 'furnizor'] as const;
export type PlanCompanyType = (typeof PLAN_COMPANY_TYPES)[number];

/** Canonical feature catalog (mirrors `plan_features.feature_key`). */
export const PLAN_FEATURE_KEYS = [
  'dashboard',
  'comenzi',
  'furnizori',
  'clienti',
  'locatii',
  'necesar',
  'angajati',
  'pontaj',
  'staff_ops',
  'concedii',
  'evenimente',
  'sarcini',
  'stoc',
  'retetar',
  'rapoarte',
  'arunca_consuma',
  'incasare',
  'firme',
] as const;
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export function isPlanFeatureKey(value: unknown): value is PlanFeatureKey {
  return (
    typeof value === 'string' &&
    (PLAN_FEATURE_KEYS as readonly string[]).includes(value)
  );
}

/** Canonical numeric limit keys (mirrors `plan_limits.limit_key`). */
export const PLAN_LIMIT_KEYS = {
  SUPPLIERS_ACCOUNT_MAX: 'suppliers.account.max',
  SUPPLIERS_MANUAL_MAX: 'suppliers.manual.max',
  LOCATIONS_MAX: 'locations.max',
  CLIENTS_MAX: 'clients.max',
  STAFF_WAREHOUSE_MAX: 'staff.warehouse.max',
  STAFF_DRIVER_MAX: 'staff.driver.max',
} as const;
export type PlanLimitKey =
  (typeof PLAN_LIMIT_KEYS)[keyof typeof PLAN_LIMIT_KEYS];

/** Limits with create/assign gates; furnizor downgrade may also force soft-blocks. */
export const FREEZE_LIMIT_KEYS: readonly PlanLimitKey[] = [
  PLAN_LIMIT_KEYS.LOCATIONS_MAX,
  PLAN_LIMIT_KEYS.CLIENTS_MAX,
  PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
  PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX,
];

/** Which limit keys are meaningful for each company type. */
export const PLAN_LIMIT_KEYS_BY_COMPANY_TYPE: Record<
  PlanCompanyType,
  readonly PlanLimitKey[]
> = {
  client: [
    PLAN_LIMIT_KEYS.SUPPLIERS_ACCOUNT_MAX,
    PLAN_LIMIT_KEYS.SUPPLIERS_MANUAL_MAX,
    PLAN_LIMIT_KEYS.LOCATIONS_MAX,
  ],
  furnizor: [
    PLAN_LIMIT_KEYS.LOCATIONS_MAX,
    PLAN_LIMIT_KEYS.CLIENTS_MAX,
    PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
    PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX,
  ],
};

/**
 * Soft-launch switch for the NEW gating (features + freeze quotas).
 *   enforce (default) — deny;  log — allow but log;  off — skip entirely.
 * Does NOT affect the pre-existing suppliers account/manual flow.
 */
export type PlanGatingMode = 'off' | 'log' | 'enforce';

export function resolvePlanGatingMode(
  raw: string | undefined | null = process.env.PLAN_GATING_MODE,
): PlanGatingMode {
  const value = String(raw ?? '').toLowerCase().trim();
  if (value === 'off' || value === 'log') return value;
  return 'enforce';
}

/** Snapshot of a company's plan as served by company-ms internal endpoint. */
export type CompanyPlanSnapshot = {
  company_id: number;
  company_type: PlanCompanyType;
  plan_code: string;
  plan_name: string;
  status: string;
  features: string[];
  limits: Record<string, number>;
  gating_mode: PlanGatingMode;
};

export const PLAN_ACCESS_ERROR_CODES = {
  FEATURE_DENIED: 'PLAN_FEATURE_DENIED',
  LIMIT_REACHED: 'SUBSCRIPTION_LIMIT_REACHED',
  COMPANY_UNRESOLVED: 'PLAN_COMPANY_UNRESOLVED',
  RESOLUTION_FAILED: 'PLAN_RESOLUTION_FAILED',
} as const;
export type PlanAccessErrorCode =
  (typeof PLAN_ACCESS_ERROR_CODES)[keyof typeof PLAN_ACCESS_ERROR_CODES];

export type PlanAccessErrorBody = {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Framework-agnostic error. `httpStatus` 403 for denied/unresolved company,
 * 503 for resolution failures (company-ms unreachable / malformed).
 * `code` is the specific code (e.g. `LOCATIONS_LIMIT_REACHED`), `error` the family.
 */
export class PlanAccessError extends Error {
  readonly httpStatus: number;
  readonly error: PlanAccessErrorCode;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    httpStatus: number;
    error: PlanAccessErrorCode;
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'PlanAccessError';
    this.httpStatus = input.httpStatus;
    this.error = input.error;
    this.code = input.code || input.error;
    this.details = input.details;
  }

  toHttpBody(): PlanAccessErrorBody {
    return {
      statusCode: this.httpStatus,
      error: this.error,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isPlanAccessError(value: unknown): value is PlanAccessError {
  return (
    value instanceof PlanAccessError ||
    (typeof value === 'object' &&
      value !== null &&
      (value as { name?: string }).name === 'PlanAccessError' &&
      typeof (value as { httpStatus?: unknown }).httpStatus === 'number')
  );
}

/* ------------------------------------------------------------------------ */
/* Pure helpers                                                              */
/* ------------------------------------------------------------------------ */

function normalizeFeatureKey(key: unknown): string {
  return String(key ?? '').toLowerCase().trim();
}

/** Normalizes the raw company-ms internal payload into a `CompanyPlanSnapshot`. Throws on malformed input. */
export function normalizeCompanyPlanSnapshot(
  companyId: number,
  raw: unknown,
): CompanyPlanSnapshot {
  const data = (raw ?? {}) as Record<string, any>;
  const rawType = String(data.company_type ?? '').toLowerCase().trim();
  if (rawType !== 'client' && rawType !== 'furnizor') {
    throw new PlanAccessError({
      httpStatus: 503,
      error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
      message: 'Tipul companiei nu a putut fi determinat pentru abonament',
      details: { company_id: companyId },
    });
  }
  const planCode = String(data?.plan?.code ?? data?.plan_code ?? '')
    .toLowerCase()
    .trim();
  if (!planCode) {
    throw new PlanAccessError({
      httpStatus: 503,
      error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
      message: 'Planul companiei nu a putut fi determinat',
      details: { company_id: companyId },
    });
  }
  const features = Array.isArray(data.features)
    ? Array.from(
        new Set(
          data.features
            .map(normalizeFeatureKey)
            .filter((k: string) => k.length > 0),
        ),
      )
    : [];
  const limits: Record<string, number> = {};
  if (data.limits && typeof data.limits === 'object') {
    for (const [key, value] of Object.entries(data.limits)) {
      const num = Number(value);
      if (key && Number.isFinite(num)) limits[key] = num;
    }
  }
  return {
    company_id: companyId,
    company_type: rawType,
    plan_code: planCode,
    plan_name: String(data?.plan?.name ?? data?.plan_name ?? planCode),
    status: String(data?.status ?? 'active'),
    features,
    limits,
    gating_mode: resolvePlanGatingMode(data?.gating_mode),
  };
}

export function hasPlanFeature(
  snapshot: Pick<CompanyPlanSnapshot, 'features'> | null | undefined,
  featureKey: string,
): boolean {
  if (!snapshot) return false;
  const key = normalizeFeatureKey(featureKey);
  return snapshot.features.some((f) => normalizeFeatureKey(f) === key);
}

export function assertPlanFeature(
  snapshot: CompanyPlanSnapshot,
  featureKey: string,
): void {
  if (hasPlanFeature(snapshot, featureKey)) return;
  throw new PlanAccessError({
    httpStatus: 403,
    error: PLAN_ACCESS_ERROR_CODES.FEATURE_DENIED,
    message:
      'Această funcționalitate nu este inclusă în planul de abonament al firmei.',
    details: {
      feature_key: normalizeFeatureKey(featureKey),
      plan_code: snapshot.plan_code,
      company_type: snapshot.company_type,
      company_id: snapshot.company_id,
    },
  });
}

/** Returns the configured limit or `null` when the plan has no value for the key. */
export function getPlanLimit(
  snapshot: Pick<CompanyPlanSnapshot, 'limits'> | null | undefined,
  limitKey: string,
): number | null {
  if (!snapshot) return null;
  const value = snapshot.limits?.[limitKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type PlanLimitCheck = {
  limit_key: string;
  limit: number;
  used: number;
  remaining: number;
  reached: boolean;
  over_limit: boolean;
};

export function describePlanLimit(
  snapshot: CompanyPlanSnapshot,
  limitKey: string,
  used: number,
): PlanLimitCheck {
  const limit = getPlanLimit(snapshot, limitKey);
  if (limit == null) {
    throw new PlanAccessError({
      httpStatus: 503,
      error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
      message: `Limita ${limitKey} nu este configurată pentru planul ${snapshot.plan_code}`,
      details: { limit_key: limitKey, plan_code: snapshot.plan_code },
    });
  }
  const safeUsed = Math.max(0, Math.trunc(Number(used) || 0));
  return {
    limit_key: limitKey,
    limit,
    used: safeUsed,
    remaining: Math.max(0, limit - safeUsed),
    reached: safeUsed >= limit,
    over_limit: safeUsed > limit,
  };
}

/**
 * FREEZE-CREATE check: deny when `used >= limit` (adding one more would exceed).
 * Existing data over the limit is never touched — only new creates are blocked.
 */
export function assertPlanLimit(
  snapshot: CompanyPlanSnapshot,
  limitKey: string,
  used: number,
  options?: { code?: string; message?: string },
): PlanLimitCheck {
  const check = describePlanLimit(snapshot, limitKey, used);
  if (!check.reached) return check;
  throw new PlanAccessError({
    httpStatus: 403,
    error: PLAN_ACCESS_ERROR_CODES.LIMIT_REACHED,
    code: options?.code || PLAN_ACCESS_ERROR_CODES.LIMIT_REACHED,
    message:
      options?.message || 'Ai atins limita planului actual de abonament.',
    details: {
      limit_key: limitKey,
      used: check.used,
      limit: check.limit,
      plan_code: snapshot.plan_code,
      company_id: snapshot.company_id,
    },
  });
}

/* ------------------------------------------------------------------------ */
/* Requester → company id (fail-closed)                                      */
/* ------------------------------------------------------------------------ */

/**
 * True for callers that are NOT tenants and therefore have no plan to check:
 * internal service calls (`bypassAuth`) and platform-wide operators without a
 * bound company_id. A bound company_id always wins (never exempt).
 */
export function isPlanGateExempt(user?: TenantAccessUser | null): boolean {
  if (!user) return false;
  if (user.bypassAuth === true) return true;
  if (resolveJwtCompanyId(user) != null) return false;
  return hasPlatformWideAccess(user);
}

/** Resolves the requester's company id or throws (FAIL-CLOSED, no Free fallback). */
export function resolvePlanCompanyIdOrFail(
  user?: TenantAccessUser | null,
): number {
  const companyId = resolveJwtCompanyId(user);
  if (companyId == null) {
    throw new PlanAccessError({
      httpStatus: 403,
      error: PLAN_ACCESS_ERROR_CODES.COMPANY_UNRESOLVED,
      message:
        'Compania utilizatorului nu a putut fi determinată; accesul la această funcționalitate este refuzat.',
    });
  }
  return companyId;
}

/* ------------------------------------------------------------------------ */
/* Company plan client (HTTP → company-ms internal, short TTL cache)          */
/* ------------------------------------------------------------------------ */

export type PlanFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};
export type PlanFetchImpl = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<PlanFetchResponse>;

export type CompanyPlanClientOptions = {
  /** company-ms base URL, e.g. http://localhost:3003 */
  companiesUrl: string;
  serviceSecret: string;
  /** Header value for `x-internal-service`, e.g. 'locations'. */
  serviceName: string;
  cacheTtlMs?: number;
  timeoutMs?: number;
  fetchImpl?: PlanFetchImpl;
  logger?: { warn: (msg: string) => void };
};

export type CompanyPlanClient = {
  getCompanyPlan(
    companyId: number,
    options?: { force?: boolean },
  ): Promise<CompanyPlanSnapshot>;
  invalidate(companyId?: number): void;
};

/**
 * Creates a small cached client for `GET /companies/internal/:id/subscription`.
 * Any failure (network, non-2xx, malformed body) → `PlanAccessError` 503.
 */
export function createCompanyPlanClient(
  options: CompanyPlanClientOptions,
): CompanyPlanClient {
  const baseUrl = String(options.companiesUrl || '').replace(/\/$/, '');
  const ttl = Math.max(0, Number(options.cacheTtlMs ?? 15000));
  const timeoutMs = Math.max(500, Number(options.timeoutMs ?? 5000));
  const fetchImpl: PlanFetchImpl | undefined =
    options.fetchImpl ??
    ((globalThis as unknown as { fetch?: PlanFetchImpl }).fetch
      ? (url, init) =>
          (globalThis as unknown as { fetch: PlanFetchImpl }).fetch(url, init)
      : undefined);
  const cache = new Map<number, { expiresAt: number; value: CompanyPlanSnapshot }>();

  async function fetchSnapshot(companyId: number): Promise<CompanyPlanSnapshot> {
    if (!fetchImpl) {
      throw new PlanAccessError({
        httpStatus: 503,
        error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
        message: 'Clientul HTTP pentru abonament nu este disponibil',
      });
    }
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetchImpl(
        `${baseUrl}/companies/internal/${companyId}/subscription`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-internal-service': options.serviceName,
            'x-service-secret': options.serviceSecret,
          },
          signal: controller?.signal,
        },
      );
      if (!response.ok) {
        throw new PlanAccessError({
          httpStatus: 503,
          error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
          message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
          details: { company_id: companyId, upstream_status: response.status },
        });
      }
      const body = await response.json();
      return normalizeCompanyPlanSnapshot(companyId, body);
    } catch (error: unknown) {
      if (isPlanAccessError(error)) throw error;
      const msg = (error as { message?: string })?.message || String(error);
      options.logger?.warn(
        `[plan-access] getCompanyPlan company=${companyId} failed: ${msg}`,
      );
      throw new PlanAccessError({
        httpStatus: 503,
        error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
        message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
        details: { company_id: companyId },
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    async getCompanyPlan(companyId, opts) {
      const cid = Number(companyId);
      if (!Number.isFinite(cid) || cid <= 0) {
        throw new PlanAccessError({
          httpStatus: 403,
          error: PLAN_ACCESS_ERROR_CODES.COMPANY_UNRESOLVED,
          message: 'Compania nu a putut fi determinată pentru abonament',
        });
      }
      const now = Date.now();
      const cached = cache.get(cid);
      if (!opts?.force && cached && cached.expiresAt > now) {
        return cached.value;
      }
      const value = await fetchSnapshot(cid);
      if (ttl > 0) cache.set(cid, { expiresAt: now + ttl, value });
      return value;
    },
    invalidate(companyId) {
      if (companyId == null) {
        cache.clear();
        return;
      }
      cache.delete(Number(companyId));
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Composite evaluators (used by per-MS guards)                              */
/* ------------------------------------------------------------------------ */

export type PlanFeatureEvaluation =
  | { allowed: true; reason: 'exempt' | 'gating_off' | 'feature_included' | 'log_only'; snapshot?: CompanyPlanSnapshot }
  | { allowed: false; error: PlanAccessError };

/**
 * Feature gate for an authenticated requester (RBAC is checked separately).
 * FAIL-CLOSED on unresolved company / unreachable company-ms unless mode is
 * `off` (skip) or `log` (allow + report the would-be error).
 */
export async function evaluatePlanFeatureAccess(
  client: CompanyPlanClient,
  user: TenantAccessUser | null | undefined,
  featureKey: string,
  mode: PlanGatingMode = resolvePlanGatingMode(),
): Promise<PlanFeatureEvaluation> {
  if (mode === 'off') return { allowed: true, reason: 'gating_off' };
  if (isPlanGateExempt(user)) return { allowed: true, reason: 'exempt' };
  try {
    const companyId = resolvePlanCompanyIdOrFail(user);
    const snapshot = await client.getCompanyPlan(companyId);
    assertPlanFeature(snapshot, featureKey);
    return { allowed: true, reason: 'feature_included', snapshot };
  } catch (error: unknown) {
    const planError = isPlanAccessError(error)
      ? error
      : new PlanAccessError({
          httpStatus: 503,
          error: PLAN_ACCESS_ERROR_CODES.RESOLUTION_FAILED,
          message: 'Abonamentul companiei nu a putut fi verificat. Reîncearcă.',
        });
    if (mode === 'log') return { allowed: true, reason: 'log_only' };
    return { allowed: false, error: planError };
  }
}

/**
 * Freeze-create quota gate for a concrete target company (already resolved and
 * tenant-checked by the caller). `countUsed` runs only when needed.
 */
export async function evaluatePlanLimitForCompany(
  client: CompanyPlanClient,
  companyId: number,
  limitKey: string,
  countUsed: () => Promise<number>,
  options?: { code?: string; message?: string; mode?: PlanGatingMode },
): Promise<{ snapshot: CompanyPlanSnapshot; check: PlanLimitCheck } | null> {
  const mode = options?.mode ?? resolvePlanGatingMode();
  if (mode === 'off') return null;
  const snapshot = await client.getCompanyPlan(companyId);
  const used = await countUsed();
  if (mode === 'log') {
    const check = describePlanLimit(snapshot, limitKey, used);
    return { snapshot, check };
  }
  const check = assertPlanLimit(snapshot, limitKey, used, options);
  return { snapshot, check };
}
