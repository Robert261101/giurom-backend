-- Soft-block work locations for subscription downgrade (reversible).
-- Apply on the locations DB (same DB as work_location).
-- Idempotent for MariaDB/MySQL 8+.

ALTER TABLE work_location
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

UPDATE work_location SET is_active = 1 WHERE is_active IS NULL;
