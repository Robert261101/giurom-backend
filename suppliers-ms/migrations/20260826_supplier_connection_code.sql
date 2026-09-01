-- Invite/association code for suppliers that have a furnizor tenant (owner_company_id).
-- Manual suppliers (owner_company_id IS NULL) keep connection_code NULL.
-- Codes are assigned by application create/ensure + backfill script (not generated here).
-- Re-run: will fail if column already exists — apply once per environment.

ALTER TABLE `suppliers`
  ADD COLUMN `connection_code` VARCHAR(16) NULL DEFAULT NULL
  AFTER `owner_company_id`;

-- Multiple NULLs allowed; non-null codes must be unique globally.
CREATE UNIQUE INDEX `UQ_suppliers_connection_code` ON `suppliers` (`connection_code`);
