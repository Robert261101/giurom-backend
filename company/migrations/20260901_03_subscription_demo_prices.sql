-- DEMO / LOCAL ONLY — replace with official prices before production.
-- Idempotent: safe to re-run on local/dev environments.

UPDATE giurombitap_company.subscription_plans
SET
  price = 0.00,
  currency = 'RON',
  billing_period = 'none',
  billing_period_days = NULL,
  description = 'Plan gratuit cu limite de bază pentru furnizori. (preț demo local)'
WHERE code = 'free';

UPDATE giurombitap_company.subscription_plans
SET
  price = 149.00,
  currency = 'RON',
  billing_period = 'monthly',
  billing_period_days = 30,
  description = 'Plan intermediar cu limite extinse. (preț demo local — înlocuiți înainte de producție)'
WHERE code = 'silver';

UPDATE giurombitap_company.subscription_plans
SET
  price = 299.00,
  currency = 'RON',
  billing_period = 'monthly',
  billing_period_days = 30,
  description = 'Plan premium cu limite maxime. (preț demo local — înlocuiți înainte de producție)'
WHERE code = 'gold';
