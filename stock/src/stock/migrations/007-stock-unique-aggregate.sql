-- Un singur agregat stock per (product_id, location_key).
-- Migrarea 006 a creat uq_stock_product_location ca INDEX normal (nu UNIQUE),
-- deci race-uri / inserturi vechi puteau lăsa mai multe rânduri pentru același produs+locație.
-- Pași: 1) merge duplicate → 2) drop index vechi → 3) UNIQUE real.

-- 1a. Mută ledger-ul pe id-ul canonic (MIN(id)) per (product_id, location_key).
UPDATE stock_transactions tx
INNER JOIN stock dup ON dup.id = tx.stock_id
INNER JOIN (
  SELECT product_id, location_key, MIN(id) AS canonical_id
  FROM stock
  GROUP BY product_id, location_key
) c
  ON c.product_id = dup.product_id
 AND c.location_key = dup.location_key
SET tx.stock_id = c.canonical_id
WHERE tx.stock_id <> c.canonical_id;

-- 1b. Sumează cantitățile pe canonic (doar unde există duplicate).
UPDATE stock keep
INNER JOIN (
  SELECT
    product_id,
    location_key,
    MIN(id) AS canonical_id,
    SUM(quantity) AS total_qty
  FROM stock
  GROUP BY product_id, location_key
  HAVING COUNT(*) > 1
) d
  ON keep.id = d.canonical_id
SET keep.quantity = d.total_qty;

-- 1c. Șterge rândurile non-canonice.
DELETE s
FROM stock s
INNER JOIN (
  SELECT product_id, location_key, MIN(id) AS canonical_id
  FROM stock
  GROUP BY product_id, location_key
) c
  ON c.product_id = s.product_id
 AND c.location_key = s.location_key
WHERE s.id <> c.canonical_id;

-- 2. Drop orice index cu acest nume (unique sau nu).
DROP PROCEDURE IF EXISTS sp_drop_index_if_exists;

DELIMITER //
CREATE PROCEDURE sp_drop_index_if_exists(
  IN p_table VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  DECLARE v_exists INT DEFAULT 0;
  SELECT COUNT(*) INTO v_exists
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = p_table
    AND index_name = p_index_name;

  IF v_exists > 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` DROP INDEX `', p_index_name, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL sp_drop_index_if_exists('stock', 'uq_stock_product_location');
DROP PROCEDURE IF EXISTS sp_drop_index_if_exists;

-- 3. UNIQUE real — previne duplicate la următoarele intrări/ieșiri.
ALTER TABLE `stock`
  ADD UNIQUE KEY `uq_stock_product_location` (`product_id`, `location_key`);
