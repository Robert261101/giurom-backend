-- Seed billing metadata for plans + backfill existing subscriptions (idempotent)
-- NOTE: Silver/Gold prices are intentionally NULL until officially configured.

INSERT INTO giurombitap_company.subscription_plans
  (code, name, sort_order, is_active, price, currency, billing_period, billing_period_days, description)
VALUES
  (
    'free',
    'Free',
    1,
    1,
    0.00,
    'RON',
    'none',
    NULL,
    'Plan gratuit cu limite de bază pentru furnizori.'
  ),
  (
    'silver',
    'Silver',
    2,
    1,
    NULL,
    'RON',
    'monthly',
    30,
    'Plan intermediar cu limite extinse. Prețul urmează a fi configurat.'
  ),
  (
    'gold',
    'Gold',
    3,
    1,
    NULL,
    'RON',
    'monthly',
    30,
    'Plan premium cu limite maxime. Prețul urmează a fi configurat.'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  currency = COALESCE(VALUES(currency), currency),
  billing_period = COALESCE(VALUES(billing_period), billing_period),
  billing_period_days = COALESCE(VALUES(billing_period_days), billing_period_days),
  description = COALESCE(VALUES(description), description),
  price = IF(VALUES(code) = 'free', VALUES(price), price);

-- Backfill billing period for existing subscriptions
UPDATE giurombitap_company.company_subscriptions cs
JOIN giurombitap_company.subscription_plans sp ON sp.code = cs.plan_code
SET
  cs.current_period_start = COALESCE(cs.current_period_start, cs.starts_at),
  cs.current_period_end = CASE
    WHEN sp.billing_period = 'none' OR sp.billing_period_days IS NULL THEN NULL
    WHEN cs.current_period_end IS NOT NULL THEN cs.current_period_end
    ELSE DATE_ADD(COALESCE(cs.current_period_start, cs.starts_at), INTERVAL sp.billing_period_days DAY)
  END,
  cs.next_billing_at = CASE
    WHEN sp.billing_period = 'none' OR sp.billing_period_days IS NULL THEN NULL
    WHEN cs.next_billing_at IS NOT NULL THEN cs.next_billing_at
    ELSE DATE_ADD(COALESCE(cs.current_period_start, cs.starts_at), INTERVAL sp.billing_period_days DAY)
  END,
  cs.payment_status = CASE
    WHEN sp.billing_period = 'none' THEN 'not_applicable'
    WHEN cs.payment_status IS NOT NULL THEN cs.payment_status
    ELSE 'pending'
  END;
