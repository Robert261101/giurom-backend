-- PR #35: coloane noi pe companies (company_type + proveniență ANAF)
-- DB producție: restosoft_company (sau giurombitap_company pe vechiul server)
-- Rulare idempotentă (safe de rerulat):
--   mysql -u restosoft_admin -p restosoft_company < 002-pr35-company-schema-idempotent.sql

SET @db = DATABASE();

-- company_type
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'company_type') = 0,
  'ALTER TABLE companies ADD COLUMN company_type ENUM(''furnizor'', ''client'') NOT NULL DEFAULT ''client'' AFTER status',
  'SELECT ''company_type exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- data_source
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'data_source') = 0,
  'ALTER TABLE companies ADD COLUMN data_source ENUM(''anaf'', ''manual'') NOT NULL DEFAULT ''manual'' AFTER notes',
  'SELECT ''data_source exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- anaf_verified_at
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'anaf_verified_at') = 0,
  'ALTER TABLE companies ADD COLUMN anaf_verified_at DATETIME NULL DEFAULT NULL AFTER data_source',
  'SELECT ''anaf_verified_at exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- anaf_original_data
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'anaf_original_data') = 0,
  'ALTER TABLE companies ADD COLUMN anaf_original_data JSON NULL DEFAULT NULL AFTER anaf_verified_at',
  'SELECT ''anaf_original_data exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
