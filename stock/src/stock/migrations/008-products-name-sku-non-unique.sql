-- Unicitate name/SKU pe nomenclator (locație), nu global pe products.
-- Bug: createProductAtLocation respingea „Sare” / SKU comun la un furnizor care
-- NU avea produsul, pentru că alt depozit/companie îl avea deja în products.
--
-- Idempotent: găsește și șterge orice UNIQUE pe coloanele name/sku, apoi
-- adaugă indecși non-unici pentru lookup.
-- Rulează pe DB-ul din stock/.env (ex. restosoft_stock), fără USE hardcodat.

DROP PROCEDURE IF EXISTS sp_drop_unique_indexes_on_column;

DELIMITER //
CREATE PROCEDURE sp_drop_unique_indexes_on_column(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64)
)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_index_name VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT DISTINCT s.index_name
    FROM information_schema.statistics s
    WHERE s.table_schema = DATABASE()
      AND s.table_name = p_table
      AND s.column_name = p_column
      AND s.non_unique = 0
      AND s.index_name <> 'PRIMARY';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_index_name;
    IF done = 1 THEN
      LEAVE read_loop;
    END IF;
    SET @drop_sql = CONCAT(
      'ALTER TABLE `', p_table, '` DROP INDEX `', v_index_name, '`'
    );
    PREPARE stmt FROM @drop_sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END //
DELIMITER ;

CALL sp_drop_unique_indexes_on_column('products', 'name');
CALL sp_drop_unique_indexes_on_column('products', 'sku');

DROP PROCEDURE IF EXISTS sp_drop_unique_indexes_on_column;

DROP PROCEDURE IF EXISTS sp_add_index_if_missing;

DELIMITER //
CREATE PROCEDURE sp_add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns_ddl VARCHAR(255)
)
BEGIN
  DECLARE v_exists INT DEFAULT 0;
  SELECT COUNT(*) INTO v_exists
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = p_table
    AND index_name = p_index_name;

  IF v_exists = 0 THEN
    SET @sql = CONCAT(
      'CREATE INDEX `', p_index_name, '` ON `', p_table, '` (', p_columns_ddl, ')'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL sp_add_index_if_missing('products', 'idx_products_name', 'name');
CALL sp_add_index_if_missing('products', 'idx_products_sku', 'sku');

DROP PROCEDURE IF EXISTS sp_add_index_if_missing;
