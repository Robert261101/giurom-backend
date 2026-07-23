-- Proveniența datelor firmei (înregistrare furnizor cu preluare ANAF)
-- DB: giurombitap_company
-- Rulare manuală (proiectul nu folosește synchronize):
--   mysql -h localhost -P 3307 -u root -p giurombitap_company < add-company-anaf-provenance.sql

ALTER TABLE companies
  ADD COLUMN data_source ENUM('anaf', 'manual') NOT NULL DEFAULT 'manual' AFTER notes,
  ADD COLUMN anaf_verified_at DATETIME NULL DEFAULT NULL AFTER data_source,
  ADD COLUMN anaf_original_data JSON NULL DEFAULT NULL AFTER anaf_verified_at;

-- Notă unicitate CUI: verificarea rămâne la nivel de aplicație (createCompany /
-- registerSupplier compară CUI normalizat cu prefix RO). Un index UNIQUE pe cui
-- ar eșua dacă există deja duplicate în date; de adăugat separat după curățare:
--   ALTER TABLE companies ADD UNIQUE INDEX UQ_companies_cui (cui);
