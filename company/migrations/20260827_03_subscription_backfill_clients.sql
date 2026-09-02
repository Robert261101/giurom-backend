-- Backfill client company subscriptions (idempotent).
-- company 1 → gold, company 15 → silver, other clients → free.
-- Does NOT touch furnizor companies. Does NOT modify supplier relations.

INSERT INTO company_subscriptions (company_id, plan_code, status, starts_at)
SELECT
  c.id,
  CASE
    WHEN c.id = 1 THEN 'gold'
    WHEN c.id = 15 THEN 'silver'
    ELSE 'free'
  END,
  'active',
  NOW(3)
FROM companies c
WHERE c.company_type = 'client'
  AND NOT EXISTS (
    SELECT 1 FROM company_subscriptions cs WHERE cs.company_id = c.id
  );
