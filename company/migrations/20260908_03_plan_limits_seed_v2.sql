-- New numeric plan limits (idempotent). Existing suppliers.account.max /
-- suppliers.manual.max are intentionally NOT touched.
--   locations.max        : company work locations (client + furnizor)
--   clients.max          : distinct client companies linked to a furnizor (client_supplier_links, quota_status != removed)
--   staff.warehouse.max  : distinct magazioneri (employees_suppliers role=warehouse) per furnizor company
--   staff.driver.max     : distinct șoferi (employees_suppliers role=driver) per furnizor company
-- Enforcement model: FREEZE-CREATE / FREEZE-ASSIGN (no auto-block on downgrade).

INSERT INTO plan_limits (plan_code, limit_key, limit_value)
VALUES
  ('free',   'locations.max', 1),
  ('silver', 'locations.max', 3),
  ('gold',   'locations.max', 10),

  ('free',   'clients.max', 3),
  ('silver', 'clients.max', 15),
  ('gold',   'clients.max', 50),

  ('free',   'staff.warehouse.max', 1),
  ('silver', 'staff.warehouse.max', 3),
  ('gold',   'staff.warehouse.max', 10),

  ('free',   'staff.driver.max', 1),
  ('silver', 'staff.driver.max', 5),
  ('gold',   'staff.driver.max', 15)
ON DUPLICATE KEY UPDATE
  limit_value = VALUES(limit_value);
