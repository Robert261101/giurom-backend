-- Allow commercial supplier_products without a stock nomenclator link
-- (furnizor account catalog managed directly on supplier_products).
-- Safe to re-run only if column is already nullable — apply once per environment.

ALTER TABLE `supplier_products`
  MODIFY COLUMN `product_id` INT NULL DEFAULT NULL;
