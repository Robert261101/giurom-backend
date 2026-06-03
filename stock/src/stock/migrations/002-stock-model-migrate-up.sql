-- =============================================================================
-- STOCK MODEL MIGRATION — UP
-- Database: giurombitap_stock
--
-- NOT ATOMIC: MySQL DDL (DROP/CREATE/ALTER) causes implicit commits.
-- mysqldump + stock_lots_backup + stock_transactions_backup are MANDATORY.
-- On failure mid-script → run 004-stock-model-rollback.sql or restore mysqldump.
--
-- stock_item_id legacy plan:
--   giurombitap_suppliers.supplier_order_item_receptions.stock_item_id = OLD lot id
--   Preserved via stock_lots_backup.id + stock_transactions.legacy_lot_id
--   Phase 4 app: rename to stock_transaction_id OR treat as legacy lot id only
--   NEVER interpret stock_item_id as new aggregate stock.id
--
-- Historical qty semantics:
--   migration-lot-entry uses CURRENT lot.quantity (post-consumption), not original receipt.
--   stock.quantity = source of truth. Pre-migration tx ledger will NOT reconcile arithmetically.
--
-- Re-run: SET @allow_retry = 1 only after 004 rollback.
-- =============================================================================

USE giurombitap_stock;

SET @allow_retry := 0;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- GUARD (stored procedure — SIGNAL requires procedure in MySQL)
-- =============================================================================

DROP PROCEDURE IF EXISTS sp_stock_migrate_guard_start;

DELIMITER //
CREATE PROCEDURE sp_stock_migrate_guard_start(IN p_allow_retry TINYINT)
BEGIN
  DECLARE v_orphan INT DEFAULT 0;
  DECLARE v_backup_lots INT DEFAULT 0;
  DECLARE v_backup_tx INT DEFAULT 0;
  DECLARE v_lot_shaped INT DEFAULT 0;

  SELECT COUNT(*) INTO v_orphan
  FROM stock_transactions st
  LEFT JOIN stock s ON s.id = st.stock_id
  WHERE s.id IS NULL;

  SELECT COUNT(*) INTO v_backup_lots
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_lots_backup';

  SELECT COUNT(*) INTO v_backup_tx
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transactions_backup';

  SELECT COUNT(*) INTO v_lot_shaped
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock' AND COLUMN_NAME = 'entry_date';

  IF v_orphan > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: orphan stock_transactions — fix before migration';
  END IF;

  IF v_lot_shaped = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: stock missing entry_date (already migrated?)';
  END IF;

  IF (v_backup_lots > 0 OR v_backup_tx > 0) AND p_allow_retry = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: backup tables exist — run 004 or SET @allow_retry=1';
  END IF;
END //
DELIMITER ;

CALL sp_stock_migrate_guard_start(@allow_retry);
DROP PROCEDURE IF EXISTS sp_stock_migrate_guard_start;

-- =============================================================================
-- STEP 0 — Mandatory snapshots
-- =============================================================================

DROP PROCEDURE IF EXISTS sp_stock_drop_backups_if_retry;

DELIMITER //
CREATE PROCEDURE sp_stock_drop_backups_if_retry(IN p_allow_retry TINYINT)
BEGIN
  IF p_allow_retry = 1 THEN
    DROP TABLE IF EXISTS stock_lots_backup;
    DROP TABLE IF EXISTS stock_transactions_backup;
  END IF;
END //
DELIMITER ;

CALL sp_stock_drop_backups_if_retry(@allow_retry);
DROP PROCEDURE IF EXISTS sp_stock_drop_backups_if_retry;

CREATE TABLE stock_lots_backup LIKE stock;
INSERT INTO stock_lots_backup SELECT * FROM stock;

CREATE TABLE stock_transactions_backup LIKE stock_transactions;
INSERT INTO stock_transactions_backup SELECT * FROM stock_transactions;

-- =============================================================================
-- STEP 1 — Drop FK safely
-- =============================================================================

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

-- =============================================================================
-- STEP 2 — Drop old lot table (DDL — implicit commit)
-- =============================================================================
DROP TABLE IF EXISTS stock;

-- =============================================================================
-- STEP 3 — Expand stock_transactions
-- Enums match TypeORM:
--   type   = entry|exit  (unchanged column)
--   source = manual|comanda (StockSource)
--   status = valid|expired|below_minimum (lot history on tx rows)
-- =============================================================================

ALTER TABLE stock_transactions
  ADD COLUMN legacy_lot_id INT NULL COMMENT 'Old lot stock.id; legacy stock_item_id reference' AFTER stock_id,
  ADD COLUMN product_id INT NULL AFTER legacy_lot_id,
  ADD COLUMN location_id INT NULL AFTER product_id,
  ADD COLUMN location_key INT NULL COMMENT 'IFNULL(location_id,-1)' AFTER location_id,
  ADD COLUMN supplier_order_item_id INT NULL AFTER location_key,
  ADD COLUMN price DECIMAL(10,2) NULL AFTER supplier_order_item_id,
  ADD COLUMN entry_date DATETIME NULL AFTER price,
  ADD COLUMN expiration_date DATETIME NULL AFTER entry_date,
  ADD COLUMN source ENUM('manual','comanda') NULL AFTER expiration_date,
  ADD COLUMN status ENUM('valid','expired','below_minimum') NULL AFTER source,
  ADD COLUMN document_url VARCHAR(1024) NULL AFTER status,
  ADD COLUMN reference_type VARCHAR(50) NULL AFTER document_url,
  ADD COLUMN reference_id INT NULL AFTER reference_type,
  ADD COLUMN updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER timestamp;

UPDATE stock_transactions st
INNER JOIN stock_lots_backup lot ON lot.id = st.stock_id
SET
  st.legacy_lot_id = lot.id,
  st.product_id = lot.product_id,
  st.location_id = lot.location_id,
  st.location_key = IFNULL(lot.location_id, -1),
  st.entry_date = COALESCE(st.entry_date, lot.entry_date),
  st.expiration_date = lot.expiration_date,
  st.source = lot.source,
  st.status = lot.status,
  st.price = lot.price,
  st.supplier_order_item_id = lot.supplier_order_item_id,
  st.document_url = lot.document_url;

-- Block if any pre-migration row failed to join lots
DROP PROCEDURE IF EXISTS sp_stock_check_tx_backfill;

DELIMITER //
CREATE PROCEDURE sp_stock_check_tx_backfill()
BEGIN
  DECLARE v_unjoined INT DEFAULT 0;
  SELECT COUNT(*) INTO v_unjoined
  FROM stock_transactions st
  INNER JOIN stock_transactions_backup b ON b.id = st.id
  WHERE st.product_id IS NULL;
  IF v_unjoined > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: pre-migration stock_transactions missing product_id after backfill';
  END IF;
END //
DELIMITER ;

CALL sp_stock_check_tx_backfill();
DROP PROCEDURE IF EXISTS sp_stock_check_tx_backfill;

ALTER TABLE stock_transactions
  MODIFY COLUMN product_id INT NOT NULL,
  MODIFY COLUMN location_key INT NOT NULL;

CREATE INDEX idx_st_product_location ON stock_transactions (product_id, location_key);
CREATE INDEX idx_st_fefo ON stock_transactions (product_id, location_key, type, expiration_date, entry_date);
CREATE INDEX idx_st_legacy_lot ON stock_transactions (legacy_lot_id);
CREATE INDEX idx_st_target ON stock_transactions (target(100));
CREATE INDEX idx_st_supplier_order_item ON stock_transactions (supplier_order_item_id);

-- =============================================================================
-- STEP 4 — New aggregate stock
-- status enum('valid','below_minimum') — aggregate only, not expired
-- =============================================================================

CREATE TABLE stock (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  location_id INT NULL,
  location_key INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('valid','below_minimum') NOT NULL DEFAULT 'valid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_product_location (product_id, location_key),
  KEY idx_stock_location_id (location_id),
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- STEP 5 — Aggregates: valid + qty>0; status always 'valid' at rebuild time
-- =============================================================================

INSERT INTO stock (product_id, location_id, location_key, quantity, status, created_at, updated_at)
SELECT
  lot.product_id,
  lot.location_id,
  IFNULL(lot.location_id, -1),
  SUM(lot.quantity),
  'valid',
  MIN(lot.created_at),
  MAX(lot.updated_at)
FROM stock_lots_backup lot
WHERE lot.status = 'valid' AND lot.quantity > 0
GROUP BY lot.product_id, IFNULL(lot.location_id, -1);

-- =============================================================================
-- STEP 5b — Zero-qty shells for historical-only combos
-- =============================================================================

INSERT IGNORE INTO stock (product_id, location_id, location_key, quantity, status)
SELECT lot.product_id, lot.location_id, IFNULL(lot.location_id, -1), 0.00, 'valid'
FROM stock_lots_backup lot
WHERE NOT (lot.status = 'valid' AND lot.quantity > 0)
GROUP BY lot.product_id, IFNULL(lot.location_id, -1);

-- =============================================================================
-- STEP 6 — migration-lot-entry per lot (CURRENT quantity — see header)
-- =============================================================================

INSERT INTO stock_transactions (
  stock_id, legacy_lot_id, product_id, location_id, location_key,
  supplier_order_item_id, type, quantity, price, entry_date, expiration_date,
  source, status, document_url, location, target, reference_type, reference_id,
  timestamp, updated_at
)
SELECT
  s.id, lot.id, lot.product_id, lot.location_id, IFNULL(lot.location_id, -1),
  lot.supplier_order_item_id, 'entry', lot.quantity, lot.price,
  lot.entry_date, lot.expiration_date, lot.source, lot.status, lot.document_url,
  COALESCE(CAST(lot.location_id AS CHAR), 'unset'),
  CONCAT('migration-lot-entry:', lot.id), 'migration_lot', lot.id,
  COALESCE(lot.entry_date, lot.created_at), lot.updated_at
FROM stock_lots_backup lot
INNER JOIN stock s ON s.product_id = lot.product_id AND s.location_key = IFNULL(lot.location_id, -1)
WHERE NOT EXISTS (
  SELECT 1 FROM stock_transactions x WHERE x.target = CONCAT('migration-lot-entry:', lot.id)
);

-- =============================================================================
-- STEP 7 — Remap pre-migration transactions to aggregate stock_id
-- =============================================================================

UPDATE stock_transactions st
INNER JOIN stock_lots_backup lot ON lot.id = st.legacy_lot_id
INNER JOIN stock s ON s.product_id = lot.product_id AND s.location_key = IFNULL(lot.location_id, -1)
SET st.stock_id = s.id
WHERE st.target IS NULL OR st.target NOT LIKE 'migration-lot-entry:%';

-- =============================================================================
-- STEP 8 — Final blocking checks before FK
-- =============================================================================

DROP PROCEDURE IF EXISTS sp_stock_migrate_guard_finish;

DELIMITER //
CREATE PROCEDURE sp_stock_migrate_guard_finish()
BEGIN
  DECLARE v_nulls INT DEFAULT 0;
  DECLARE v_lot_count INT DEFAULT 0;
  DECLARE v_entry_count INT DEFAULT 0;
  DECLARE v_orphan INT DEFAULT 0;

  SELECT COUNT(*) INTO v_nulls
  FROM stock_transactions
  WHERE stock_id IS NULL OR product_id IS NULL OR location_key IS NULL;

  SELECT COUNT(*) INTO v_lot_count FROM stock_lots_backup;
  SELECT COUNT(*) INTO v_entry_count
  FROM stock_transactions WHERE target LIKE 'migration-lot-entry:%';

  SELECT COUNT(*) INTO v_orphan
  FROM stock_transactions st
  LEFT JOIN stock s ON s.id = st.stock_id
  WHERE s.id IS NULL;

  IF v_nulls > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: NULL stock_id/product_id/location_key in stock_transactions';
  END IF;

  IF v_entry_count <> v_lot_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: migration-lot-entry count != stock_lots_backup count';
  END IF;

  IF v_orphan > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Aborted: orphan stock_transactions after remap';
  END IF;
END //
DELIMITER ;

CALL sp_stock_migrate_guard_finish();
DROP PROCEDURE IF EXISTS sp_stock_migrate_guard_finish;

-- =============================================================================
-- STEP 9 — FK + audit
-- =============================================================================

ALTER TABLE stock_transactions
  MODIFY COLUMN stock_id INT NOT NULL,
  ADD CONSTRAINT fk_stock_transactions_stock
    FOREIGN KEY (stock_id) REFERENCES stock(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS stock_schema_migrations (
  id INT NOT NULL AUTO_INCREMENT,
  migration_name VARCHAR(255) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_migration_name (migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO stock_schema_migrations (migration_name, notes)
VALUES (
  '002-stock-model-migrate-up',
  'stock=aggregate; migration-lot-entry=current lot qty; stock_item_id=legacy lot ids; tx ledger not historically reconciled'
)
ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP, notes = VALUES(notes);

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

SELECT '002 complete — run 003-stock-model-postflight.sql before deploying app' AS result;
