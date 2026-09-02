-- Per-client quota state for Manual suppliers.
-- Values: active | blocked | removed

CREATE TABLE IF NOT EXISTS `client_manual_supplier_state` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_company_id` INT NOT NULL,
  `supplier_id` INT NOT NULL,
  `quota_status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_client_manual_supplier_state_client_supplier` (`client_company_id`, `supplier_id`),
  KEY `IDX_client_manual_supplier_state_client` (`client_company_id`),
  KEY `IDX_client_manual_supplier_state_supplier` (`supplier_id`),
  CONSTRAINT `FK_client_manual_supplier_state_supplier`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
