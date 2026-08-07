-- GIU-13: preț preferențial per client și produs furnizor

CREATE TABLE IF NOT EXISTS supplier_product_client_prices (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_company_id INT NOT NULL,
  client_company_id INT NOT NULL,
  supplier_product_id INT NOT NULL,
  preferred_price DECIMAL(10,2) NOT NULL,
  updated_by_user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_supplier_product_price (client_company_id, supplier_product_id),
  KEY idx_current_price_supplier_company (supplier_company_id),
  KEY idx_current_price_client_company (client_company_id),
  CONSTRAINT fk_client_price_supplier_product
    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_product_client_price_history (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_company_id INT NOT NULL,
  client_company_id INT NOT NULL,
  supplier_product_id INT NOT NULL,
  old_price DECIMAL(10,2) NULL,
  new_price DECIMAL(10,2) NULL,
  action ENUM('created', 'updated', 'removed') NOT NULL,
  changed_by_user_id INT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_price_history_client_product_changed (client_company_id, supplier_product_id, changed_at),
  KEY idx_price_history_supplier_company (supplier_company_id),
  CONSTRAINT fk_price_history_supplier_product
    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
