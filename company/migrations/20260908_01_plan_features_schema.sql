-- Plan feature catalog: what modules a plan unlocks, per company type.
-- Access = RBAC ∩ plan features. Runs on company DB (via migration-manifest).
-- Idempotent.

CREATE TABLE IF NOT EXISTS plan_features (
  id INT NOT NULL AUTO_INCREMENT,
  plan_code VARCHAR(32) NOT NULL,
  company_type ENUM('client', 'furnizor') NOT NULL,
  feature_key VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_plan_features_plan_type_key (plan_code, company_type, feature_key),
  KEY IDX_plan_features_type_plan (company_type, plan_code),
  CONSTRAINT FK_plan_features_plan
    FOREIGN KEY (plan_code) REFERENCES subscription_plans (code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
