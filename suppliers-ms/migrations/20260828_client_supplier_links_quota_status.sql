-- Per-client quota state for Cont suppliers (independent of is_active).
-- Values: active | blocked | removed
-- Default active keeps existing rows unblocked.

ALTER TABLE `client_supplier_links`
  ADD COLUMN `quota_status` VARCHAR(16) NOT NULL DEFAULT 'active'
  AFTER `is_active`;

CREATE INDEX `IDX_client_supplier_links_client_quota`
  ON `client_supplier_links` (`client_company_id`, `quota_status`);
