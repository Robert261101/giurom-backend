export const PLAN_CODES = ['free', 'silver', 'gold'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const LIMIT_KEYS = {
  ACCOUNT_MAX: 'suppliers.account.max',
  MANUAL_MAX: 'suppliers.manual.max',
} as const;

export const DEFAULT_FREE_LIMITS: Record<string, number> = {
  [LIMIT_KEYS.ACCOUNT_MAX]: 1,
  [LIMIT_KEYS.MANUAL_MAX]: 3,
};

export { isPlatformSubscriptionAdmin } from '@giurom/tenant-access';

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
