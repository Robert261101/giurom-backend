-- Tabelă listă comenzi (doar vizualizare / CRUD simplu)
-- Rulează în baza de date a microserviciului stock dacă DB_SYNCHRONIZE nu este true.

CREATE TABLE IF NOT EXISTS `order_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `work_location_id` int NOT NULL,
  `list_date` date NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'in_asteptare',
  `items` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_order_lists_work_location_id` (`work_location_id`),
  KEY `idx_order_lists_list_date` (`list_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
