-- Gestiunea (depozitul din giurom 2.0) aleasă pe linia de comandă.
--
-- În App1 coloanele sunt **inerte**: stocul intră în continuare în stocul general al
-- locației, exact ca până acum. Sunt o etichetă de rutare, cărată până la documentul de
-- intrare, unde App2 o folosește ca să pună fiecare produs pe gestiunea lui.
--
-- De ce și pe recepție, nu doar pe comandă: o linie de comandă se recepționează în tranșe
-- (`newlyReceivedQty` din `markOrderAsPartiallyReceived`), iar tranșele pot ajunge în
-- gestiuni diferite. Cu eticheta doar pe comandă, cazul recepției parțiale s-ar pierde.

ALTER TABLE `supplier_order_items`
  ADD COLUMN IF NOT EXISTS `giurom2_zone_id` INT NULL
    COMMENT 'storage_zones.id din giurom 2.0 — gestiunea aleasă la comandă';

ALTER TABLE `supplier_order_item_receptions`
  ADD COLUMN IF NOT EXISTS `giurom2_zone_id` INT NULL
    COMMENT 'gestiunea pe care intră această tranșă în giurom 2.0';

-- Catalog local de gestiuni, împrospătat periodic din giurom 2.0.
--
-- Cache, nu apel live: formularul de comandă trebuie să meargă și când App2 e picat, iar
-- numele gestiunii trebuie să rămână tipăribil pe comandă chiar dacă între timp se schimbă.
CREATE TABLE IF NOT EXISTS `giurom2_zones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `location_id` INT NOT NULL,
  `external_zone_id` INT NOT NULL COMMENT 'storage_zones.id din giurom 2.0',
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(50) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `synced_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_giurom2_zones_location_zone` (`company_id`, `location_id`, `external_zone_id`),
  KEY `IDX_giurom2_zones_location` (`company_id`, `location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
