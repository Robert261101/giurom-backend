-- Backfill furnizor company subscriptions → Free (idempotent).
-- Furnizor Free includes the whole operational flow; new quotas are
-- freeze-create only, so nothing existing is disabled by this backfill.

INSERT INTO company_subscriptions (company_id, plan_code, status, starts_at, payment_status)
SELECT
  c.id,
  'free',
  'active',
  NOW(3),
  'not_applicable'
FROM companies c
WHERE c.company_type = 'furnizor'
  AND NOT EXISTS (
    SELECT 1 FROM company_subscriptions cs WHERE cs.company_id = c.id
  );
