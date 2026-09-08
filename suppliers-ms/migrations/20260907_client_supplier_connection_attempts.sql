-- Anti-bruteforce state for POST /suppliers/connect (per client company).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS `client_supplier_connection_attempts` (
  `client_company_id` INT NOT NULL,
  `failed_count` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL DEFAULT NULL,
  `last_failed_at` DATETIME(3) NULL DEFAULT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `updated_by_user_id` INT NULL DEFAULT NULL,
  PRIMARY KEY (`client_company_id`),
  KEY `IDX_client_supplier_connection_attempts_locked_until` (`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
