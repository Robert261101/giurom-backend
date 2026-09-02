-- Seed Free / Silver / Gold + limits (idempotent)
INSERT INTO subscription_plans (code, name, sort_order, is_active)
VALUES
  ('free', 'Free', 1, 1),
  ('silver', 'Silver', 2, 1),
  ('gold', 'Gold', 3, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO plan_limits (plan_code, limit_key, limit_value)
VALUES
  ('free', 'suppliers.account.max', 1),
  ('free', 'suppliers.manual.max', 3),
  ('silver', 'suppliers.account.max', 3),
  ('silver', 'suppliers.manual.max', 7),
  ('gold', 'suppliers.account.max', 10),
  ('gold', 'suppliers.manual.max', 25)
ON DUPLICATE KEY UPDATE
  limit_value = VALUES(limit_value);
