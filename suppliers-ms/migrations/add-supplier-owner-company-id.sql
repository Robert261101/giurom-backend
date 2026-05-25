-- Link operational supplier records to furnizor tenant companies (companies-ms).
-- owner_company_id references companies.id; enforced at application level (cross-DB).

ALTER TABLE `suppliers`
  ADD COLUMN `owner_company_id` INT NULL DEFAULT NULL
  AFTER `is_active`;

-- One supplier per furnizor company; multiple NULLs allowed for client-only suppliers.
CREATE UNIQUE INDEX `UQ_suppliers_owner_company_id` ON `suppliers` (`owner_company_id`);
