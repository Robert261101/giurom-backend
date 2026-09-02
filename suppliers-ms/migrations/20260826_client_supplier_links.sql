-- Company-level association: client company ↔ account supplier.
-- Source of truth for "client is linked to this account supplier".
-- No cross-DB FK on client_company_id (companies-ms).
-- Re-run: will fail if table already exists — apply once per environment.

CREATE TABLE `client_supplier_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_company_id` INT NOT NULL,
  `supplier_id` INT NOT NULL,
  `linked_by_user_id` INT NULL DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_client_supplier_links_client_supplier` (`client_company_id`, `supplier_id`),
  KEY `IDX_client_supplier_links_client_company_id` (`client_company_id`),
  KEY `IDX_client_supplier_links_supplier_id` (`supplier_id`),
  CONSTRAINT `FK_client_supplier_links_supplier`
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
