-- Asociere persistentă: companie client + produs furnizor → produs nomenclator client (stock.products.id)

-- Un produs furnizor poate avea o singură asociere per companie client; mai multe produse furnizor pot indica același produs client.

-- Furnizorul se deduce prin JOIN supplier_products.supplier_id (fără supplier_id denormalizat în mapping).



CREATE TABLE IF NOT EXISTS supplier_product_client_mappings (

  id INT NOT NULL AUTO_INCREMENT,

  client_company_id INT NOT NULL,

  supplier_product_id INT NOT NULL,

  client_stock_product_id INT NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_client_supplier_product (client_company_id, supplier_product_id),

  KEY idx_mapping_client_stock_product (client_company_id, client_stock_product_id),

  CONSTRAINT fk_mapping_supplier_product

    FOREIGN KEY (supplier_product_id) REFERENCES supplier_products (id) ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
