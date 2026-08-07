-- GIU-13: audit snapshots for preferred-price history (actor name + standard price at change time)

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS changed_by_name VARCHAR(255) NULL AFTER changed_by_user_id;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS standard_price_snapshot DECIMAL(10,2) NULL AFTER edit_source;

ALTER TABLE supplier_product_client_price_history
  ADD COLUMN IF NOT EXISTS standard_price_with_vat_snapshot DECIMAL(10,2) NULL AFTER standard_price_snapshot;
