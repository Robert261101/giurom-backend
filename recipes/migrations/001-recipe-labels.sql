-- Etichete pentru preparate rețetă (folosit de recipe-preparations + scheduler)
CREATE TABLE IF NOT EXISTS recipe_labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_preparation_id INT NOT NULL,
  label_code VARCHAR(100) NOT NULL,
  label_file_path VARCHAR(500) NOT NULL,
  generated_by_employee_id INT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_recipe_labels_label_code (label_code),
  KEY IDX_recipe_labels_prep (recipe_preparation_id),
  CONSTRAINT FK_recipe_labels_preparation
    FOREIGN KEY (recipe_preparation_id) REFERENCES recipe_preparations (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
