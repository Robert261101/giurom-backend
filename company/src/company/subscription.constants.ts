import { PLAN_LIMIT_KEYS } from '@giurom/tenant-access';

export const PLAN_CODES = ['free', 'silver', 'gold'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const LIMIT_KEYS = {
  ACCOUNT_MAX: PLAN_LIMIT_KEYS.SUPPLIERS_ACCOUNT_MAX,
  MANUAL_MAX: PLAN_LIMIT_KEYS.SUPPLIERS_MANUAL_MAX,
  LOCATIONS_MAX: PLAN_LIMIT_KEYS.LOCATIONS_MAX,
  CLIENTS_MAX: PLAN_LIMIT_KEYS.CLIENTS_MAX,
  STAFF_WAREHOUSE_MAX: PLAN_LIMIT_KEYS.STAFF_WAREHOUSE_MAX,
  STAFF_DRIVER_MAX: PLAN_LIMIT_KEYS.STAFF_DRIVER_MAX,
} as const;

/**
 * Restrictive defaults used only when a plan has no row for a key
 * (broken seed). Mirrors the Free tier — never permissive.
 */
export const DEFAULT_FREE_LIMITS: Record<string, number> = {
  [LIMIT_KEYS.ACCOUNT_MAX]: 1,
  [LIMIT_KEYS.MANUAL_MAX]: 3,
  [LIMIT_KEYS.LOCATIONS_MAX]: 1,
  [LIMIT_KEYS.CLIENTS_MAX]: 3,
  [LIMIT_KEYS.STAFF_WAREHOUSE_MAX]: 1,
  [LIMIT_KEYS.STAFF_DRIVER_MAX]: 1,
};

export {
  isPlatformSubscriptionAdmin,
  PLAN_LIMIT_KEYS_BY_COMPANY_TYPE,
  resolvePlanGatingMode,
} from '@giurom/tenant-access';

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === 'string' && (PLAN_CODES as readonly string[]).includes(value);
}

/** Higher rank = higher tier (free < silver < gold). */
export const PLAN_RANK: Record<PlanCode, number> = {
  free: 0,
  silver: 1,
  gold: 2,
};

export function getPlanRank(planCode: string): number {
  const code = String(planCode || '').toLowerCase().trim();
  return isPlanCode(code) ? PLAN_RANK[code] : -1;
}

export function isPlanUpgrade(fromCode: string, toCode: string): boolean {
  return getPlanRank(toCode) > getPlanRank(fromCode);
}

export function isPlanDowngrade(fromCode: string, toCode: string): boolean {
  return getPlanRank(toCode) < getPlanRank(fromCode);
}

export function normalizePlanLimits(
  rows: Array<{ limit_key: string; limit_value: number }>,
): Record<string, number> {
  const limits: Record<string, number> = { ...DEFAULT_FREE_LIMITS };
  for (const row of rows) {
    const key = String(row.limit_key || '').trim();
    const value = Number(row.limit_value);
    if (key && Number.isFinite(value)) {
      limits[key] = value;
    }
  }
  return limits;
}

/** Keeps only the limit keys relevant to a company type (FE never sees account/manual on furnizor). */
export function pickLimitsForCompanyType(
  limits: Record<string, number>,
  companyType: 'client' | 'furnizor',
  keysByType: Record<'client' | 'furnizor', readonly string[]>,
): Record<string, number> {
  const picked: Record<string, number> = {};
  for (const key of keysByType[companyType]) {
    if (typeof limits[key] === 'number') picked[key] = limits[key];
  }
  return picked;
}

export function normalizePlanFeatures(
  rows: Array<{ feature_key: string }>,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const key = String(row.feature_key || '').toLowerCase().trim();
    if (key) set.add(key);
  }
  return Array.from(set).sort();
}
