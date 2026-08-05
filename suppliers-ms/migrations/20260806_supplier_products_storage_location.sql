-- GIU-09: locație fizică a produsului în depozitul furnizorului (informativ)
-- Specific nomenclatorului furnizorului (supplier_products), nu catalogului global.

ALTER TABLE `supplier_products`
  ADD COLUMN IF NOT EXISTS `storage_location` VARCHAR(255) NULL
    COMMENT 'Locație fizică în depozit (ex. Raft A3). NULL = nespecificată'
    AFTER `image_url`;
