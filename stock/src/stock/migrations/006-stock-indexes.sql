-- Indecși pe stock / stock_transactions — idempotent (verifică information_schema înainte de fiecare CREATE INDEX).
-- Motiv: 002-stock-model-migrate-up.sql definește deja idx_st_* și uq_stock_product_location / idx_stock_location_id,
-- dar auditul din 2026-07-22 a confirmat că nu există în DB de producție (probabil 002 nu a fost rulat integral acolo).
-- Acest script e sigur de rulat indiferent de starea curentă — sare peste orice index deja existent.

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
    SET @sql = CONCAT('CREATE INDEX `', p_index_name, '` ON `', p_table, '` (', p_columns_ddl, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- stock_transactions — ledger append-only, filtrat constant după product_id/location_key/stock_id.
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_product_location', 'product_id, location_key');
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_fefo', 'product_id, location_key, type, expiration_date, entry_date');
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_legacy_lot', 'legacy_lot_id');
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_target', 'target(100)');
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_supplier_order_item', 'supplier_order_item_id');
CALL sp_add_index_if_missing('stock_transactions', 'idx_st_stock_id', 'stock_id');

-- stock — lookup agregat per (product_id, location_key), fan-out per product_id, filtrare per location_id.
CALL sp_add_index_if_missing('stock', 'uq_stock_product_location', 'product_id, location_key');
CALL sp_add_index_if_missing('stock', 'idx_stock_location_id', 'location_id');

DROP PROCEDURE IF EXISTS sp_add_index_if_missing;
