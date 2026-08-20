-- Migrare minimă și sigură pentru suport UTF-8 complet pe `suppliers`.
--
-- Reconstrucție din surse:
-- - migrarea `add-supplier-owner-company-id.sql` adaugă doar `owner_company_id`
--   + UNIQUE index `UQ_suppliers_owner_company_id`
-- - migrarea `20260817_supplier_company_hq_fields.sql` adaugă doar:
--     `activity_code` VARCHAR(10) NULL DEFAULT NULL
--     `headquarters_name` VARCHAR(255) NULL DEFAULT NULL
-- - nicio altă migrare din `suppliers-ms/migrations` nu schimbă definiția altor
--   coloane din tabela `suppliers`
--
-- Problema raportată (`Incorrect string value` pe `headquarters_name`) apare fiindcă
-- acea coloană a fost adăugată fără charset explicit și a moștenit charset/collation-ul
-- actual al tabelei.
--
-- Pentru MySQL/MariaDB, `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4 COLLATE ...`
-- convertește toate coloanele text existente (`CHAR`, `VARCHAR`, `TEXT`, etc.) la
-- noul charset/collation, păstrând tipul, lungimea, NULL/NOT NULL, DEFAULT și indexurile.
--
-- Prin urmare, `MODIFY COLUMN` NU este necesar aici și ar introduce risc inutil
-- de a devia de la schema reală din producție.
--
-- Migrarea este idempotentă pentru scenariul curent: dacă o rulare anterioară a
-- executat deja `CONVERT TO CHARACTER SET` înainte să pice în altă parte, această
-- comandă poate fi rulată din nou în siguranță.

ALTER TABLE `suppliers`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
