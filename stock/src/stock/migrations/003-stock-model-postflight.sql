-- =============================================================================
-- STOCK MODEL MIGRATION — POST-FLIGHT (verification — read-only)
-- Database: giurombitap_stock
-- Run AFTER 002-stock-model-migrate-up.sql, BEFORE deploying new app code.
--
-- ALL checks below should PASS. Any FAIL requires investigation or 004 rollback.
-- =============================================================================

USE giurombitap_stock;

-- =============================================================================
-- CHECK 1 — Required tables exist
-- =============================================================================
SELECT
  t.TABLE_NAME,
  t.TABLE_ROWS,
  CASE WHEN t.TABLE_NAME IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS check_result
FROM information_schema.TABLES t
WHERE t.TABLE_SCHEMA = 'giurombitap_stock'
  AND t.TABLE_NAME IN ('stock', 'stock_lots_backup', 'stock_transactions', 'stock_transactions_backup');

-- =============================================================================
-- CHECK 2 — migration-lot-entry count = stock_lots_backup count (MUST MATCH)
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM stock_lots_backup lot) AS lots_backed_up,
  (SELECT COUNT(*) FROM stock_transactions st WHERE st.target LIKE 'migration-lot-entry:%') AS migration_entries,
  CASE
    WHEN (SELECT COUNT(*) FROM stock_lots_backup lot) =
         (SELECT COUNT(*) FROM stock_transactions st WHERE st.target LIKE 'migration-lot-entry:%')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS migration_entry_count_check;

-- =============================================================================
-- CHECK 3 — Aggregate quantity = SUM(valid lots) per product+location (MUST: 0 diffs)
-- Only rows with quantity > 0 in aggregate; zero shells excluded from this check
-- =============================================================================
SELECT
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS aggregate_qty_reconciliation,
  COUNT(*) AS mismatch_rows
FROM (
  SELECT s.id, s.product_id, s.location_key, s.quantity AS agg_qty, lot_sum.sum_qty
  FROM stock s
  INNER JOIN (
    SELECT
      lot.product_id,
      IFNULL(lot.location_id, -1) AS location_key,
      SUM(lot.quantity) AS sum_qty
    FROM stock_lots_backup lot
    WHERE lot.status = 'valid' AND lot.quantity > 0
    GROUP BY lot.product_id, IFNULL(lot.location_id, -1)
  ) lot_sum ON lot_sum.product_id = s.product_id AND lot_sum.location_key = s.location_key
  WHERE s.quantity > 0
    AND ABS(s.quantity - lot_sum.sum_qty) > 0.001
) mismatches;

-- Detail rows if mismatch (should be empty)
SELECT
  s.id,
  s.product_id,
  s.location_key,
  s.quantity AS agg_qty,
  lot_sum.sum_qty AS lot_sum_qty,
  ABS(s.quantity - lot_sum.sum_qty) AS diff
FROM stock s
INNER JOIN (
  SELECT
    lot.product_id,
    IFNULL(lot.location_id, -1) AS location_key,
    SUM(lot.quantity) AS sum_qty
  FROM stock_lots_backup lot
  WHERE lot.status = 'valid' AND lot.quantity > 0
  GROUP BY lot.product_id, IFNULL(lot.location_id, -1)
) lot_sum ON lot_sum.product_id = s.product_id AND lot_sum.location_key = s.location_key
WHERE ABS(s.quantity - lot_sum.sum_qty) > 0.001;

-- =============================================================================
-- CHECK 4 — Orphan stock_transactions (MUST BE 0)
-- =============================================================================
SELECT
  COUNT(*) AS orphan_tx_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS orphan_tx_check
FROM stock_transactions st
LEFT JOIN stock s ON s.id = st.stock_id
WHERE s.id IS NULL;

-- =============================================================================
-- CHECK 5 — No NULL stock_id / product_id / location_key (MUST BE 0)
-- =============================================================================
SELECT
  SUM(CASE WHEN st.stock_id IS NULL THEN 1 ELSE 0 END) AS null_stock_id,
  SUM(CASE WHEN st.product_id IS NULL THEN 1 ELSE 0 END) AS null_product_id,
  SUM(CASE WHEN st.location_key IS NULL THEN 1 ELSE 0 END) AS null_location_key,
  CASE
    WHEN SUM(CASE WHEN st.stock_id IS NULL OR st.product_id IS NULL OR st.location_key IS NULL THEN 1 ELSE 0 END) = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS null_columns_check
FROM stock_transactions st;

-- =============================================================================
-- CHECK 6 — Enum columns unchanged / correct after migration
-- =============================================================================
SELECT c.TABLE_NAME, c.COLUMN_NAME, c.COLUMN_TYPE
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = 'giurombitap_stock'
  AND (
    (c.TABLE_NAME = 'stock_transactions' AND c.COLUMN_NAME = 'type')
    OR (c.TABLE_NAME = 'stock_transactions' AND c.COLUMN_NAME = 'source')
    OR (c.TABLE_NAME = 'stock_transactions' AND c.COLUMN_NAME = 'status')
    OR (c.TABLE_NAME = 'stock' AND c.COLUMN_NAME = 'status')
  )
ORDER BY c.TABLE_NAME, c.COLUMN_NAME;

-- Expected:
--   stock_transactions.type   = enum('entry','exit')
--   stock_transactions.source = enum('manual','comanda')
--   stock_transactions.status = enum('valid','expired','below_minimum')
--   stock.status              = enum('valid','below_minimum')

-- =============================================================================
-- CHECK 7 — legacy_lot_id populated on pre-migration transactions
-- =============================================================================
SELECT
  COUNT(*) AS pre_migration_tx,
  SUM(CASE WHEN st.legacy_lot_id IS NULL THEN 1 ELSE 0 END) AS missing_legacy_lot_id,
  CASE
    WHEN SUM(CASE WHEN st.legacy_lot_id IS NULL THEN 1 ELSE 0 END) = 0 THEN 'PASS'
    ELSE 'WARN'
  END AS legacy_lot_id_check
FROM stock_transactions st
INNER JOIN stock_transactions_backup b ON b.id = st.id;

-- =============================================================================
-- CHECK 8 — Historical ledger reconciliation (INFORMATIONAL — expected NOT to match)
-- =============================================================================
SELECT
  'INFO: stock.quantity is source of truth; pre-migration tx ledger may not reconcile' AS warning,
  (SELECT SUM(s.quantity) FROM stock s WHERE s.quantity > 0) AS total_aggregate_qty,
  (
    SELECT COALESCE(SUM(CASE WHEN st.type = 'entry' THEN st.quantity ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN st.type = 'exit' THEN st.quantity ELSE 0 END), 0)
    FROM stock_transactions st
  ) AS tx_ledger_net_all_types,
  (
    SELECT COALESCE(SUM(st.quantity), 0)
    FROM stock_transactions st
    WHERE st.target LIKE 'migration-lot-entry:%'
  ) AS migration_entry_sum,
  (
    SELECT COALESCE(SUM(st.quantity), 0)
    FROM stock_transactions st
    INNER JOIN stock_transactions_backup b ON b.id = st.id
  ) AS pre_migration_tx_qty_sum;

-- migration-lot-entry uses CURRENT lot balance, not original receipt qty.
-- Existing EXIT rows + reduced lot balances mean tx_ledger_net_all_types != total_aggregate_qty is OK.

-- =============================================================================
-- CHECK 9 — Aggregate row counts
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM stock s) AS total_aggregate_rows,
  (SELECT COUNT(*) FROM stock s WHERE s.quantity > 0) AS aggregate_rows_with_qty,
  (SELECT COUNT(*) FROM stock s WHERE s.quantity = 0) AS zero_qty_shell_rows,
  (
    SELECT COUNT(*)
    FROM (
      SELECT 1
      FROM stock_lots_backup lot
      WHERE lot.status = 'valid' AND lot.quantity > 0
      GROUP BY lot.product_id, IFNULL(lot.location_id, -1)
    ) expected
  ) AS expected_rows_with_qty;

-- =============================================================================
-- CHECK 10 — Sample FEFO metadata on migration entries
-- =============================================================================
SELECT
  st.id,
  st.product_id,
  st.location_key,
  st.quantity,
  st.expiration_date,
  st.entry_date,
  st.source,
  st.status,
  st.legacy_lot_id,
  st.target
FROM stock_transactions st
WHERE st.target LIKE 'migration-lot-entry:%'
ORDER BY st.product_id, st.expiration_date, st.entry_date
LIMIT 10;

-- =============================================================================
-- CHECK 11 — Migration audit row
-- =============================================================================
SELECT m.*
FROM stock_schema_migrations m
WHERE m.migration_name = '002-stock-model-migrate-up';

-- =============================================================================
-- SUMMARY (single row — all must say PASS to proceed)
-- =============================================================================
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM stock_lots_backup lot) =
         (SELECT COUNT(*) FROM stock_transactions st WHERE st.target LIKE 'migration-lot-entry:%')
    THEN 'PASS'
    ELSE 'FAIL'
  END AS check_migration_entry_count,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM stock s
      INNER JOIN (
        SELECT
          lot.product_id,
          IFNULL(lot.location_id, -1) AS location_key,
          SUM(lot.quantity) AS sum_qty
        FROM stock_lots_backup lot
        WHERE lot.status = 'valid' AND lot.quantity > 0
        GROUP BY lot.product_id, IFNULL(lot.location_id, -1)
      ) lot_sum ON lot_sum.product_id = s.product_id AND lot_sum.location_key = s.location_key
      WHERE s.quantity > 0 AND ABS(s.quantity - lot_sum.sum_qty) > 0.001
    ) = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS check_aggregate_qty,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM stock_transactions st
      LEFT JOIN stock s ON s.id = st.stock_id
      WHERE s.id IS NULL
    ) = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS check_orphan_tx,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM stock_transactions st
      WHERE st.stock_id IS NULL OR st.product_id IS NULL OR st.location_key IS NULL
    ) = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS check_null_columns,
  'INFO: tx ledger net != aggregate qty is expected for pre-migration history' AS check_historical_reconciliation;
