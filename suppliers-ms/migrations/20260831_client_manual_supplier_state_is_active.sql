-- Per-client operational active flag for Manual suppliers (independent of suppliers.is_active).

ALTER TABLE `client_manual_supplier_state`
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1
  AFTER `quota_status`;
