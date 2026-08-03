-- Un singur agregat stock per (product_id, location_key).
-- Migrarea 006 a creat uq_stock_product_location ca INDEX normal (nu UNIQUE),
-- deci race-uri / inserturi vechi puteau lăsa mai multe rânduri pentru același produs+locație.
-- Pași: 1) mută ledger → 2) cantitate din ledger (nu SUM pe duplicate) → 3) șterge extra → 4) UNIQUE.

-- 1. Mută ledger-ul pe id-ul canonic (MIN(id)) per (product_id, location_key).
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

-- 2. Recalculează cantitatea pe canonic din ledger (ENTRY − EXIT).
--    NU sumăm quantity de pe rândurile duplicate — ar dubla stocul dacă sunt copii.
UPDATE stock keep
INNER JOIN (
  SELECT product_id, location_key, MIN(id) AS canonical_id
  FROM stock
  GROUP BY product_id, location_key
  HAVING COUNT(*) > 1
) d ON keep.id = d.canonical_id
LEFT JOIN (
  SELECT
    product_id,
    location_key,
    COALESCE(SUM(CASE WHEN type = 'entry' THEN quantity ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type = 'exit' THEN quantity ELSE 0 END), 0) AS net_qty
  FROM stock_transactions
  GROUP BY product_id, location_key
) ledger
  ON ledger.product_id = keep.product_id
 AND ledger.location_key = keep.location_key
SET keep.quantity = GREATEST(0, COALESCE(ledger.net_qty, keep.quantity));

-- 3. Șterge rândurile non-canonice.
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

-- 4. Drop orice index cu acest nume (unique sau nu), apoi UNIQUE real.
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

ALTER TABLE `stock`
  ADD UNIQUE KEY `uq_stock_product_location` (`product_id`, `location_key`);
