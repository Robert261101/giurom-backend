import { SubscriptionPlan } from './entity/subscription-plan.entity';
import { CompanySubscription } from './entity/company-subscription.entity';

export type BillingPeriodMetrics = {
  days_total: number | null;
  days_elapsed: number | null;
  days_remaining: number | null;
  progress_percent: number | null;
};

export function parseDecimal(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  const time = value.getTime();
  return Number.isFinite(time) ? value.toISOString() : null;
}

const DAY_MS = 86_400_000;

function computeProgressPercent(
  elapsedMs: number,
  totalMs: number,
  remainingMs: number,
): number {
  if (totalMs <= 0) return 0;
  if (remainingMs <= 0) {
    return 100;
  }
  const rawPercent = (elapsedMs / totalMs) * 100;
  return Math.min(99, Math.max(0, Math.floor(rawPercent)));
}

export function computeBillingPeriodMetrics(
  periodStart: Date | null | undefined,
  periodEnd: Date | null | undefined,
  billingPeriodDays?: number | null,
  nowMs: number = Date.now(),
): BillingPeriodMetrics {
  const startMs = periodStart?.getTime();
  const endMs = periodEnd?.getTime();

  if (
    startMs != null &&
    Number.isFinite(startMs) &&
    endMs != null &&
    Number.isFinite(endMs) &&
    endMs > startMs
  ) {
    const totalMs = endMs - startMs;
    const remainingMs = Math.max(endMs - nowMs, 0);
    const elapsedMs = Math.min(Math.max(nowMs - startMs, 0), totalMs);
    const daysTotal = Math.max(1, Math.ceil(totalMs / DAY_MS));
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.floor(elapsedMs / DAY_MS)),
    );
    const daysRemaining =
      remainingMs <= 0 ? 0 : Math.floor(remainingMs / DAY_MS);
    const progress = computeProgressPercent(elapsedMs, totalMs, remainingMs);
    return {
      days_total: daysTotal,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      progress_percent: progress,
    };
  }

  if (billingPeriodDays != null && billingPeriodDays > 0 && startMs != null) {
    const daysTotal = billingPeriodDays;
    const elapsedDays = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS));
    const daysElapsed = Math.min(daysTotal, elapsedDays);
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);
    const progress =
      daysRemaining <= 0
        ? 100
        : Math.min(
            99,
            Math.max(0, Math.floor((daysElapsed / daysTotal) * 100)),
          );
    return {
      days_total: daysTotal,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      progress_percent: progress,
    };
  }

  return {
    days_total: null,
    days_elapsed: null,
    days_remaining: null,
    progress_percent: null,
  };
}

export function resolvePaymentStatusForPlan(
  plan: Pick<SubscriptionPlan, 'billing_period' | 'price'>,
): string {
  if (plan.billing_period === 'none' || plan.billing_period == null) {
    return 'not_applicable';
  }
  const price = parseDecimal(plan.price);
  if (price == null || price <= 0) {
    return 'pending';
  }
  return 'pending';
}

export function applyBillingFieldsOnPlanActivation(
  plan: SubscriptionPlan,
  existingSub: CompanySubscription | null,
): Partial<CompanySubscription> {
  const now = new Date();
  const updates: Partial<CompanySubscription> = {
    current_period_start: now,
  };

  if (plan.billing_period === 'none' || !plan.billing_period_days) {
    updates.current_period_end = null;
    updates.next_billing_at = null;
    updates.payment_status = 'not_applicable';
    updates.payment_method = null;
    updates.payment_method_label = null;
  } else {
    const periodEnd = new Date(now);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + Number(plan.billing_period_days));
    updates.current_period_end = periodEnd;
    updates.next_billing_at = periodEnd;
    updates.payment_status = resolvePaymentStatusForPlan(plan);
    if (!existingSub?.payment_method) {
      updates.payment_method = null;
      updates.payment_method_label = null;
    }
  }

  return updates;
}

export function formatPeriodTimeRemaining(
  periodEnd: Date | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!periodEnd) return '—';
  const endMs = periodEnd.getTime();
  if (!Number.isFinite(endMs)) return '—';

  const remainingMs = endMs - nowMs;
  if (remainingMs <= 0) return 'Expirat';

  if (remainingMs >= DAY_MS) {
    const days = Math.floor(remainingMs / DAY_MS);
    return days === 1 ? '1 zi rămasă' : `${days} zile rămase`;
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    const minutePart = String(minutes).padStart(2, '0');
    return minutes > 0 ? `${hours}h ${minutePart}m rămase` : `${hours}h rămase`;
  }

  return `${Math.max(minutes, 1)}m rămase`;
}

export function buildPlanBillingView(plan: SubscriptionPlan) {
  return {
    price: parseDecimal(plan.price),
    currency: plan.currency ?? 'RON',
    billing_period: plan.billing_period,
    billing_period_days: plan.billing_period_days,
    description: plan.description,
    price_configured: parseDecimal(plan.price) != null,
  };
}
