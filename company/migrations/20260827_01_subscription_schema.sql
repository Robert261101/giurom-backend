-- Phase 2: client company subscriptions (plans + limits)
-- DB: giurombitap_company
-- Do NOT auto-run on other environments.

CREATE TABLE IF NOT EXISTS giurombitap_company.subscription_plans (
  code VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS giurombitap_company.plan_limits (
  id INT NOT NULL AUTO_INCREMENT,
  plan_code VARCHAR(32) NOT NULL,
  limit_key VARCHAR(64) NOT NULL,
  limit_value INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_plan_limits_plan_key (plan_code, limit_key),
  CONSTRAINT FK_plan_limits_plan
    FOREIGN KEY (plan_code) REFERENCES giurombitap_company.subscription_plans (code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS giurombitap_company.company_subscriptions (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  plan_code VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  starts_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ends_at DATETIME(3) NULL,
  updated_by_user_id INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_company_subscriptions_company (company_id),
  CONSTRAINT FK_company_subscriptions_plan
    FOREIGN KEY (plan_code) REFERENCES giurombitap_company.subscription_plans (code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
