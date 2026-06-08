-- =============================================================================
-- STOCK MODEL MIGRATION — PRE-FLIGHT (read-only + blocking checks)
-- Database: giurombitap_stock
-- Run BEFORE 002-stock-model-migrate-up.sql
-- =============================================================================

USE giurombitap_stock;

-- =============================================================================
-- SECTION A — Baseline counts
-- =============================================================================

SELECT 'stock (lot table today)' AS label, COUNT(*) AS cnt FROM stock;
SELECT 'stock_transactions' AS label, COUNT(*) AS cnt FROM stock_transactions;

-- =============================================================================
-- SECTION B — Lot distribution
-- =============================================================================

SELECT product_id, location_id, COUNT(*) AS lot_count, SUM(quantity) AS total_qty
FROM stock
GROUP BY product_id, location_id
HAVING lot_count > 1
ORDER BY lot_count DESC
LIMIT 50;

SELECT product_id, COUNT(*) AS null_location_lots, SUM(quantity) AS sum_qty
FROM stock
WHERE location_id IS NULL
GROUP BY product_id
HAVING null_location_lots > 1
ORDER BY null_location_lots DESC
LIMIT 20;

-- =============================================================================
-- SECTION C — Status breakdown
-- =============================================================================

SELECT status, COUNT(*) AS rows_cnt, SUM(quantity) AS sum_qty
FROM stock
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS historical_only_lots
FROM stock
WHERE NOT (status = 'valid' AND quantity > 0);

SELECT COUNT(*) AS expected_aggregate_rows_with_qty
FROM (
  SELECT product_id, IFNULL(location_id, -1) AS location_key
  FROM stock
  WHERE status = 'valid' AND quantity > 0
  GROUP BY product_id, IFNULL(location_id, -1)
) t;

SELECT COUNT(*) AS expected_aggregate_rows_including_zero_shells
FROM (
  SELECT product_id, IFNULL(location_id, -1) AS location_key
  FROM stock
  GROUP BY product_id, IFNULL(location_id, -1)
) t;

-- =============================================================================
-- SECTION D — BLOCKING: orphan stock_transactions (must be 0)
-- =============================================================================

SELECT
  COUNT(*) AS orphan_transaction_count,
  'MUST BE 0 — 002 aborts if > 0' AS requirement
FROM stock_transactions st
LEFT JOIN stock s ON s.id = st.stock_id
WHERE s.id IS NULL;

SELECT st.id, st.stock_id, st.type, st.quantity, st.target
FROM stock_transactions st
LEFT JOIN stock s ON s.id = st.stock_id
WHERE s.id IS NULL
LIMIT 50;

-- =============================================================================
-- SECTION E — Verify enum/column types (must match TypeORM before migration)
-- =============================================================================

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'giurombitap_stock'
  AND TABLE_NAME IN ('stock', 'stock_transactions')
  AND COLUMN_NAME IN ('source', 'status', 'type')
ORDER BY TABLE_NAME, COLUMN_NAME;

-- Expected BEFORE migration:
--   stock.source              = enum('manual','comanda')
--   stock.status              = enum('valid','expired','below_minimum')
--   stock_transactions.type   = enum('entry','exit')

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'giurombitap_stock'
  AND TABLE_NAME = 'stock'
ORDER BY ORDINAL_POSITION;

-- =============================================================================
-- SECTION F — FK on stock_transactions → stock
-- =============================================================================

SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'giurombitap_stock'
  AND TABLE_NAME = 'stock_transactions'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- =============================================================================
-- SECTION G — Re-run guard (backup tables must not exist)
-- =============================================================================

SELECT TABLE_NAME, TABLE_ROWS,
  'If present: run 004 rollback OR set @allow_retry=1 in 002' AS note
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'giurombitap_stock'
  AND TABLE_NAME IN ('stock_lots_backup', 'stock_transactions_backup');

-- Only if stock_schema_migrations already exists from prior partial run:
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'giurombitap_stock' AND TABLE_NAME = 'stock_schema_migrations';
-- If table exists: SELECT * FROM stock_schema_migrations;

-- =============================================================================
-- SECTION H — Cross-DB: supplier_order_item_receptions.stock_item_id (legacy)
-- =============================================================================
-- Run manually against giurombitap_suppliers:
-- SELECT COUNT(*) FROM supplier_order_item_receptions WHERE stock_item_id IS NOT NULL;

-- =============================================================================
-- SECTION I — Historical reconciliation warning
-- =============================================================================
-- migration-lot-entry uses CURRENT lot.quantity, not original receipt qty.
-- stock.quantity after migration = source of truth; tx ledger may not reconcile.

-- =============================================================================
-- SECTION J — Hard blocking gate (stored procedure)
-- =============================================================================

DROP PROCEDURE IF EXISTS sp_stock_preflight_gate;

DELIMITER //
CREATE PROCEDURE sp_stock_preflight_gate()
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
      SET MESSAGE_TEXT = 'Preflight FAIL: orphan stock_transactions exist';
  END IF;

  IF v_backup_lots > 0 OR v_backup_tx > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight FAIL: backup tables exist — run 004 or set @allow_retry=1 in 002';
  END IF;

  IF v_lot_shaped = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Preflight FAIL: stock is not lot-shaped (already migrated?)';
  END IF;

  SELECT 'Preflight PASS — safe to run 002-stock-model-migrate-up.sql' AS result;
END //
DELIMITER ;

CALL sp_stock_preflight_gate();
DROP PROCEDURE IF EXISTS sp_stock_preflight_gate;
