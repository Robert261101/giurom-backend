-- Billing fields for subscription plans + company subscriptions + invoices (future)
-- Rulează pe baza din company/.env (restosoft_company în producție).
-- Idempotent: safe to re-run

-- Plan catalog billing metadata
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subscription_plans'
    AND COLUMN_NAME = 'price'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE subscription_plans
     ADD COLUMN price DECIMAL(10,2) NULL AFTER is_active,
     ADD COLUMN currency VARCHAR(3) NULL DEFAULT ''RON'' AFTER price,
     ADD COLUMN billing_period VARCHAR(16) NULL AFTER currency,
     ADD COLUMN billing_period_days INT NULL AFTER billing_period,
     ADD COLUMN description VARCHAR(255) NULL AFTER billing_period_days',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Per-company billing state
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_subscriptions'
    AND COLUMN_NAME = 'current_period_start'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE company_subscriptions
     ADD COLUMN current_period_start DATETIME(3) NULL AFTER ends_at,
     ADD COLUMN current_period_end DATETIME(3) NULL AFTER current_period_start,
     ADD COLUMN next_billing_at DATETIME(3) NULL AFTER current_period_end,
     ADD COLUMN payment_status VARCHAR(32) NULL AFTER next_billing_at,
     ADD COLUMN payment_method VARCHAR(32) NULL AFTER payment_status,
     ADD COLUMN payment_method_label VARCHAR(128) NULL AFTER payment_method',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Future invoices (empty until payment provider is integrated)
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  invoice_number VARCHAR(64) NULL,
  period_start DATETIME(3) NULL,
  period_end DATETIME(3) NULL,
  issued_at DATETIME(3) NULL,
  amount DECIMAL(10,2) NULL,
  currency VARCHAR(3) NULL DEFAULT 'RON',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  download_url VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_subscription_invoices_company (company_id),
  KEY idx_subscription_invoices_issued (issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
