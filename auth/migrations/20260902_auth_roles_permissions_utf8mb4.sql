-- Suport UTF-8 pe rolurile si permisiunile din auth.
--
-- `roles`, `permissions` si `role_permissions` sunt latin1_swedish_ci (la fel ca
-- default-ul serverului). `seed_client_admin_role.sql` insereaza descrieri cu
-- diacritice romanesti — „propria firma", „Magazioner operational" — iar ă (U+0103)
-- si ț (U+021B) nu au reprezentare in latin1, deci MySQL respinge randul:
--
--   ERROR 1366 (22007): Incorrect string value: '\xC4\x83)' for column `roles`.`description`
--
-- Rolurile vechi (angajat, magazioner, sofer) nu au declansat eroarea doar fiindca
-- exista deja, deci `INSERT ... WHERE NOT EXISTS` nu producea niciun rand de scris.
--
-- Acelasi tratament ca `suppliers-ms/migrations/20260819_suppliers_utf8mb4.sql`:
-- `CONVERT TO CHARACTER SET` converteste toate coloanele text existente, pastrand
-- tipul, lungimea, NULL/NOT NULL, DEFAULT si indexurile. Datele actuale sunt ASCII,
-- deci conversia nu le modifica. Idempotenta: se poate rula din nou in siguranta.
--
-- De rulat INAINTE de seed_client_admin_role.sql.

ALTER TABLE `roles`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `permissions`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
