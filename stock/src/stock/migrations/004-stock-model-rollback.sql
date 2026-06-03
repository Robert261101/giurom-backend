-- =============================================================================
-- STOCK MODEL MIGRATION — ROLLBACK
-- Database: giurombitap_stock
--
-- NOT ATOMIC: DDL auto-commits in MySQL. If this fails mid-script, use mysqldump.
-- Requires stock_lots_backup + stock_transactions_backup from 002.
-- =============================================================================

USE giurombitap_stock;

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP PROCEDURE IF EXISTS sp_stock_rollback_guard;

DELIMITER //
CREATE PROCEDURE sp_stock_rollback_guard()
BEGIN
  DECLARE v_lots INT DEFAULT 0;
  DECLARE v_tx INT DEFAULT 0;

  SELECT COUNT(*) INTO v_lots
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_lots_backup';

  SELECT COUNT(*) INTO v_tx
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transactions_backup';

  IF v_lots = 0 OR v_tx = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback aborted: backup tables missing — restore mysqldump';
  END IF;
END //
DELIMITER ;

CALL sp_stock_rollback_guard();
DROP PROCEDURE IF EXISTS sp_stock_rollback_guard;

SELECT
  (SELECT COUNT(*) FROM stock_lots_backup) AS backup_lot_rows,
  (SELECT COUNT(*) FROM stock_transactions_backup) AS backup_tx_rows;

-- STEP 1 — Drop FK safely
SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_transactions'
    AND REFERENCED_TABLE_NAME = 'stock'
  LIMIT 1
);

DROP PROCEDURE IF EXISTS sp_stock_drop_fk_if_exists;

DELIMITER //
CREATE PROCEDURE sp_stock_drop_fk_if_exists(IN p_fk_name VARCHAR(255))
BEGIN
  IF p_fk_name IS NOT NULL AND p_fk_name != '' THEN
    SET @sql = CONCAT('ALTER TABLE stock_transactions DROP FOREIGN KEY `', p_fk_name, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL sp_stock_drop_fk_if_exists(@fk_name);
DROP PROCEDURE IF EXISTS sp_stock_drop_fk_if_exists;

-- STEP 2 — Drop aggregate stock
DROP TABLE IF EXISTS stock;

-- STEP 3 — Restore lot stock
CREATE TABLE stock LIKE stock_lots_backup;
INSERT INTO stock SELECT * FROM stock_lots_backup;

-- STEP 4 — Restore original transactions
DROP TABLE IF EXISTS stock_transactions;
CREATE TABLE stock_transactions LIKE stock_transactions_backup;
INSERT INTO stock_transactions SELECT * FROM stock_transactions_backup;

-- STEP 5 — Re-add FK (adjust constraint name if duplicate error)
ALTER TABLE stock_transactions
  ADD CONSTRAINT fk_stock_transactions_stock_lot
    FOREIGN KEY (stock_id) REFERENCES stock(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 6 — Audit cleanup
DELETE FROM stock_schema_migrations WHERE migration_name = '002-stock-model-migrate-up';

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- Verification
SELECT
  (SELECT COUNT(*) FROM stock) AS restored_stock,
  (SELECT COUNT(*) FROM stock_lots_backup) AS backup_lots,
  CASE WHEN (SELECT COUNT(*) FROM stock) = (SELECT COUNT(*) FROM stock_lots_backup)
       THEN 'PASS' ELSE 'FAIL' END AS stock_match;

SELECT
  (SELECT COUNT(*) FROM stock_transactions) AS restored_tx,
  (SELECT COUNT(*) FROM stock_transactions_backup) AS backup_tx,
  CASE WHEN (SELECT COUNT(*) FROM stock_transactions) = (SELECT COUNT(*) FROM stock_transactions_backup)
       THEN 'PASS' ELSE 'FAIL' END AS tx_match;

SELECT CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS lot_shaped
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock' AND COLUMN_NAME = 'entry_date';

SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS no_legacy_lot_id
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transactions' AND COLUMN_NAME = 'legacy_lot_id';

SELECT 'Rollback complete. Re-run 002 with SET @allow_retry=1 if needed.' AS result;
