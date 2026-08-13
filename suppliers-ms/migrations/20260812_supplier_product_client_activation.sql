-- Activare explicită produs furnizor per companie client (tenant furnizor).
-- Lipsă rând = folosește supplier_products.is_active (compatibilitate produse vechi).
-- După ce există cel puțin un rând pentru un produs, activarea e per-client.

CREATE TABLE IF NOT EXISTS supplier_product_client_activation (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_company_id INT NOT NULL,
  client_company_id INT NOT NULL,
  supplier_product_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_supplier_product_activation (client_company_id, supplier_product_id),
  KEY idx_activation_supplier_company (supplier_company_id),
  KEY idx_activation_client_company (client_company_id),
  CONSTRAINT fk_activation_supplier_product
    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
