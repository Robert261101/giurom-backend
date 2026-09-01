-- Client-specific active flag for Cont associations.
-- suppliers.is_active remains GLOBAL and must not be toggled by a client.
-- Re-run: fails if column already exists — apply once per environment.

ALTER TABLE `client_supplier_links`
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1
  AFTER `linked_by_user_id`;
