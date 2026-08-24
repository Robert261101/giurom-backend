-- Gestiunea (depozitul din giurom 2.0) aleasă la aruncare.
--
-- Inertă în App1, ca la comenzi: stocul se scade în continuare din stocul general al
-- locației. E eticheta de rutare, trimisă pe canalul de deșeuri, după care giurom 2.0 scade
-- din gestiunea corectă în loc să pună diferența pe cea implicită.
--
-- Fără ea, o aruncare din bar apărea în giurom 2.0 ca scădere din depozit: suma pe locație
-- rămânea corectă, repartiția nu.

ALTER TABLE `waste_requests`
  ADD COLUMN IF NOT EXISTS `giurom2_zone_id` INT NULL
    COMMENT 'storage_zones.id din giurom 2.0 — gestiunea din care se aruncă';

-- Catalog local de gestiuni pentru stock-ms.
--
-- Duplicat intenționat față de `giurom2_zones` din suppliers-ms: sunt microservicii cu baze
-- separate, iar un read-model mic, împrospătat din sursă, e mai ieftin decât un apel
-- sincron între servicii pe calea unui formular.
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
