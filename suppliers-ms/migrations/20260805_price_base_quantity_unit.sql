-- price_base: preț raportat la o cantitate de bază (ex. 2.50 lei / 100 gr)
-- Compatibilitate: NULL = baza 1 în unitatea produsului (comportament vechi)

ALTER TABLE `supplier_products`
  ADD COLUMN IF NOT EXISTS `price_base_quantity` DECIMAL(10, 4) NULL
    COMMENT 'Cantitatea pentru care se aplică price_per_unit (ex. 100). NULL = 1'
    AFTER `price_per_unit`,
  ADD COLUMN IF NOT EXISTS `price_base_unit` VARCHAR(50) NULL
    COMMENT 'Unitatea bazei de preț (ex. gr). NULL = unit_of_measure'
    AFTER `price_base_quantity`;

ALTER TABLE `supplier_order_items`
  ADD COLUMN IF NOT EXISTS `price_base_quantity` DECIMAL(10, 4) NULL
    COMMENT 'Snapshot bază preț la creare. NULL = 1 (comenzi vechi)'
    AFTER `price_per_unit`,
  ADD COLUMN IF NOT EXISTS `price_base_unit` VARCHAR(50) NULL
    COMMENT 'Snapshot unitate bază preț la creare'
    AFTER `price_base_quantity`;
