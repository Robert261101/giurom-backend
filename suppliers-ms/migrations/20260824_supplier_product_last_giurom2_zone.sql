-- Ultima gestiune aleasă pe produs furnizor, pe locația clientului.
--
-- La următoarea comandă, formularul precompletează selectorul cu această valoare
-- (doar dacă gestiunea e încă în setul locației din giurom 2.0). Nu afectează stocul
-- App1 — e doar memorie de UI / etichetă de rutare.

CREATE TABLE IF NOT EXISTS `supplier_product_last_giurom2_zones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `location_id` INT NOT NULL,
  `supplier_product_id` INT NOT NULL COMMENT 'supplier_products.id',
  `giurom2_zone_id` INT NOT NULL COMMENT 'storage_zones.id din giurom 2.0',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_last_zone_company_loc_product` (`company_id`, `location_id`, `supplier_product_id`),
  KEY `IDX_last_zone_location` (`company_id`, `location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
