/**
 * Jest: npx jest src/company/subscription-billing.util.test.ts
 */
import { describe, expect, it } from '@jest/globals';
import {
  applyBillingFieldsOnPlanActivation,
  computeBillingPeriodMetrics,
  parseDecimal,
  formatPeriodTimeRemaining,
  resolvePaymentStatusForPlan,
} from './subscription-billing.util';

describe('subscription-billing.util', () => {
  it('parseDecimal handles string decimals', () => {
    expect(parseDecimal('19.99')).toBe(19.99);
    expect(parseDecimal(null)).toBeNull();
  });

  it('computeBillingPeriodMetrics from period start/end', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T00:00:00.000Z');
    const metrics = computeBillingPeriodMetrics(
      start,
      end,
      null,
      start.getTime() + 15 * 86_400_000,
    );
    expect(metrics.days_total).toBe(30);
    expect(metrics.progress_percent).toBe(50);
    expect(metrics.days_remaining).toBeGreaterThan(0);
  });

  it('at period start progress is 0 and full time remains', () => {
    const start = new Date('2026-08-04T08:46:43.000Z');
    const end = new Date('2026-09-02T11:50:30.000Z');
    const metrics = computeBillingPeriodMetrics(start, end, null, start.getTime());
    expect(metrics.progress_percent).toBe(0);
    expect(metrics.days_elapsed).toBe(0);
    expect(metrics.days_remaining).toBeGreaterThan(0);
  });

  it('near period end keeps progress below 100 while time remains', () => {
    const start = new Date('2026-08-04T08:46:43.000Z');
    const end = new Date('2026-09-02T11:50:30.000Z');
    const nowMs = end.getTime() - 3 * 60 * 60 * 1000;
    const metrics = computeBillingPeriodMetrics(start, end, null, nowMs);

    expect(metrics.days_remaining).toBe(0);
    expect(metrics.progress_percent).toBeLessThan(100);
    expect(metrics.progress_percent).toBeGreaterThanOrEqual(99);
  });

  it('does not show 100% before period end for real subscription window', () => {
    const start = new Date('2026-08-04T08:46:43.000Z');
    const end = new Date('2026-09-02T11:50:30.000Z');
    const nowMs = end.getTime() - 5 * 60 * 60 * 1000;
    const metrics = computeBillingPeriodMetrics(start, end, null, nowMs);

    expect(metrics.progress_percent).toBe(99);
    expect(metrics.days_remaining).toBe(0);
  });

  it('after period end progress is 100 and no days remain', () => {
    const start = new Date('2026-08-04T08:46:43.000Z');
    const end = new Date('2026-09-02T11:50:30.000Z');
    const metrics = computeBillingPeriodMetrics(
      start,
      end,
      null,
      end.getTime() + 1_000,
    );

    expect(metrics.progress_percent).toBe(100);
    expect(metrics.days_remaining).toBe(0);
    expect(metrics.days_elapsed).toBeGreaterThanOrEqual(metrics.days_total! - 1);
  });

  it('mid-period metrics stay consistent', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T00:00:00.000Z');
    const nowMs = start.getTime() + 15 * 86_400_000;
    const metrics = computeBillingPeriodMetrics(start, end, null, nowMs);

    expect(metrics.days_elapsed).toBe(15);
    expect(metrics.days_total).toBe(30);
    expect(metrics.days_remaining).toBe(15);
    expect(metrics.progress_percent).toBe(50);
  });

  it('formatPeriodTimeRemaining uses days when >= 24h remain', () => {
    const end = new Date('2026-09-05T12:00:00.000Z');
    const nowMs = new Date('2026-09-03T10:00:00.000Z').getTime();
    expect(formatPeriodTimeRemaining(end, nowMs)).toBe('2 zile rămase');
  });

  it('formatPeriodTimeRemaining uses hours and minutes under 24h', () => {
    const end = new Date('2026-09-02T20:32:00.000Z');
    const nowMs = new Date('2026-09-02T12:00:00.000Z').getTime();
    expect(formatPeriodTimeRemaining(end, nowMs)).toBe('8h 32m rămase');
  });

  it('formatPeriodTimeRemaining shows expired after end', () => {
    const end = new Date('2026-09-02T11:50:30.000Z');
    expect(
      formatPeriodTimeRemaining(end, end.getTime() + 1_000),
    ).toBe('Expirat');
  });

  it('free plan sets not_applicable payment status', () => {
    const plan = {
      billing_period: 'none',
      price: '0',
      billing_period_days: null,
      currency: 'RON',
      description: null,
    } as any;
    expect(resolvePaymentStatusForPlan(plan)).toBe('not_applicable');
    const updates = applyBillingFieldsOnPlanActivation(plan, null);
    expect(updates.payment_status).toBe('not_applicable');
    expect(updates.current_period_end).toBeNull();
  });

  it('paid plan sets billing period end', () => {
    const plan = {
      billing_period: 'monthly',
      price: null,
      billing_period_days: 30,
      currency: 'RON',
      description: null,
    } as any;
    const updates = applyBillingFieldsOnPlanActivation(plan, null);
    expect(updates.current_period_start).toBeInstanceOf(Date);
    expect(updates.current_period_end).toBeInstanceOf(Date);
    expect(updates.next_billing_at).toBeInstanceOf(Date);
    expect(updates.payment_status).toBe('pending');
  });
});
