-- Soft-block staff links for furnizor subscription downgrade (reversible).
-- Apply on the suppliers DB (same DB as employees_suppliers).
-- Idempotent for MariaDB/MySQL 8+.

ALTER TABLE employees_suppliers
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Backfill any NULL (defensive; column is NOT NULL DEFAULT 1).
UPDATE employees_suppliers SET is_active = 1 WHERE is_active IS NULL;
