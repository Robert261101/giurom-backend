-- =============================================================================
-- Migrare calendar-ms v1 — giurombitap_calendar
-- Tabele: event_category, calendar_event, calendar_event_participant
-- Fără recurență. Fără FK cross-database (company, location, employee).
--
-- NU RULA fără aprobare explicită.
-- DB_SYNCHRONIZE trebuie să rămână false.
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_category (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_category_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_event (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  location_id INT NULL,
  created_by_employee_id INT NOT NULL,
  category_id INT NOT NULL,
  event_type ENUM('general', 'meeting') NOT NULL DEFAULT 'general',
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 0,
  is_company_wide TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_calendar_event_company_start (company_id, start_datetime),
  KEY idx_calendar_event_location_start (location_id, start_datetime),
  KEY idx_calendar_event_start (start_datetime),
  KEY idx_calendar_event_category (category_id),
  KEY idx_calendar_event_type (event_type),
  KEY idx_calendar_event_status (status),
  KEY idx_calendar_event_company_wide (is_company_wide),
  CONSTRAINT fk_calendar_event_category
    FOREIGN KEY (category_id) REFERENCES event_category (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_event_participant (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL,
  employee_id INT NOT NULL,
  response_status ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  responded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_calendar_event_participant (event_id, employee_id),
  KEY idx_calendar_event_participant_employee_status (employee_id, response_status),
  CONSTRAINT fk_calendar_event_participant_event
    FOREIGN KEY (event_id) REFERENCES calendar_event (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed categorii implicite (idempotent pe code)
INSERT INTO event_category (code, name, is_active)
VALUES
  ('personal', 'Personal', 1),
  ('work', 'Work', 1),
  ('health', 'Health', 1),
  ('education', 'Education', 1),
  ('other', 'Other', 1),
  ('meeting', 'Meeting', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active);
