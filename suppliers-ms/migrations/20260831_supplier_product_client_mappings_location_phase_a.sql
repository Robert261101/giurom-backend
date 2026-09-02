-- VAL 3 Phase A: per-location product mapping (additive).
-- Drops company-wide unique key so multiple locations per client+supplier_product are allowed.
-- client_location_id NULL = legacy row (pre-VAL 3); runtime requires explicit location after VAL 3.

ALTER TABLE `supplier_product_client_mappings`
  ADD COLUMN `client_location_id` INT NULL
  AFTER `client_company_id`;

ALTER TABLE `supplier_product_client_mappings`
  DROP INDEX `uq_client_supplier_product`;

ALTER TABLE `supplier_product_client_mappings`
  ADD UNIQUE KEY `uq_client_location_supplier_product` (
    `client_company_id`,
    `client_location_id`,
    `supplier_product_id`
  );

CREATE INDEX `idx_mapping_client_company_location`
  ON `supplier_product_client_mappings` (`client_company_id`, `client_location_id`);
