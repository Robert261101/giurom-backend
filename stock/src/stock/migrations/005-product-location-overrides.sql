-- Override-uri nomenclator per locație (nume/unitate/etc. independente între locații)
CREATE TABLE IF NOT EXISTS product_location_overrides (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  location_id INT NULL,
  location_key INT NOT NULL,
  name VARCHAR(150) NULL,
  unit VARCHAR(50) NULL,
  sku VARCHAR(100) NULL,
  description TEXT NULL,
  photo VARCHAR(255) NULL,
  is_consumable TINYINT(1) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_location_override (product_id, location_key),
  KEY idx_plo_location_key (location_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
