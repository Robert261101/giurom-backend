-- GIU-12: preferință client — vizibilitate produs furnizor per companie client
-- Lipsă rând = vizibil (toate produsele active rămân vizibile după deploy).

CREATE TABLE IF NOT EXISTS supplier_product_client_visibility (
  id INT NOT NULL AUTO_INCREMENT,
  client_company_id INT NOT NULL,
  supplier_product_id INT NOT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_supplier_product_visibility (client_company_id, supplier_product_id),
  KEY idx_visibility_client_company (client_company_id),
  CONSTRAINT fk_visibility_supplier_product
    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
