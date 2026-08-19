-- Company + HQ fields for client-managed suppliers (no company tenant).
-- activity_code / headquarters_name do not exist on suppliers today;
-- other company data maps onto existing supplier columns (vat_number, supplier_name, etc.).

ALTER TABLE `suppliers`
  ADD COLUMN `activity_code` VARCHAR(10) NULL DEFAULT NULL AFTER `contact_person`,
  ADD COLUMN `headquarters_name` VARCHAR(255) NULL DEFAULT NULL AFTER `activity_code`;
