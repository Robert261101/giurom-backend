-- VAL 3 Phase B: enforce NOT NULL on client_location_id.
--
-- Prerequisite (must be 0 before running):
--   SELECT COUNT(*) FROM supplier_product_client_mappings WHERE client_location_id IS NULL;
--
-- If any NULL rows remain, abort and complete VAL 5 backfill first.

ALTER TABLE `supplier_product_client_mappings`
  MODIFY COLUMN `client_location_id` INT NOT NULL;
