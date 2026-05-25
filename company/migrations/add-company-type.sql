-- Add company_type for tenant classification (furnizor | client)
ALTER TABLE companies
  ADD COLUMN company_type ENUM('furnizor', 'client') NOT NULL DEFAULT 'client'
  AFTER status;
