-- Precizie cantități stoc: 3 zecimale (ex. 0.525 kg), aliniat cu App2 inventory.
-- Înainte: DECIMAL(10,2) rotunjea 11.895 → 11.90 și sync-ul împingea valoarea trunchiată.

ALTER TABLE `stock`
  MODIFY COLUMN `quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000;

ALTER TABLE `stock_transactions`
  MODIFY COLUMN `quantity` DECIMAL(12,3) NOT NULL;
