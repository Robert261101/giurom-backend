-- Scope supplier nomenclature by furnizor tenant company (companies.id).
-- Backfill from suppliers.owner_company_id; variants inherit via supplier_product_id.

ALTER TABLE `supplier_products`
  ADD COLUMN `company_id` INT NULL DEFAULT NULL
  AFTER `supplier_id`;

CREATE INDEX `IDX_supplier_products_company_id`
  ON `supplier_products` (`company_id`);

CREATE INDEX `IDX_supplier_products_company_supplier`
  ON `supplier_products` (`company_id`, `supplier_id`);

UPDATE `supplier_products` sp
INNER JOIN `suppliers` s ON s.id = sp.supplier_id
SET sp.company_id = s.owner_company_id
WHERE s.owner_company_id IS NOT NULL;
