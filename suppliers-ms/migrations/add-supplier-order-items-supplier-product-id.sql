-- supplier_order_items: legătură explicită la nomenclatura furnizorului
-- product_id = stock.products.id (recepție/stoc)
-- supplier_product_id = supplier_products.id (linie comandată la furnizor)

ALTER TABLE `supplier_order_items`
  ADD COLUMN IF NOT EXISTS `supplier_product_id` INT NULL
    COMMENT 'supplier_products.id'
    AFTER `product_id`;

CREATE INDEX IF NOT EXISTS `IDX_supplier_order_items_supplier_product_id`
  ON `supplier_order_items` (`supplier_product_id`);
