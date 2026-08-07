-- GIU-13 follow-up: UTC timestamps + audit fields for VAT-aware preferred price edits

-- Existing rows were written with MariaDB SYSTEM (local RO) wall-clock while TypeORM
-- reads with timezone +00:00 (treated as UTC → UI showed +3h).
UPDATE supplier_product_client_price_history
SET changed_at = CONVERT_TZ(changed_at, 'SYSTEM', '+00:00')
WHERE changed_at IS NOT NULL;

UPDATE supplier_product_client_prices
SET
  created_at = CONVERT_TZ(created_at, 'SYSTEM', '+00:00'),
  updated_at = CONVERT_TZ(updated_at, 'SYSTEM', '+00:00')
WHERE id > 0;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) NULL AFTER new_price;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS old_price_with_vat DECIMAL(10,2) NULL AFTER vat_rate;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS new_price_with_vat DECIMAL(10,2) NULL AFTER old_price_with_vat;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS edit_source ENUM('without_vat', 'with_vat') NULL AFTER new_price_with_vat;
