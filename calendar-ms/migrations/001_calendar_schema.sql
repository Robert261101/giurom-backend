-- Migrare calendar-ms pentru giurombitap_calendar (SUPRASĂ de 002_calendar_v1_schema.sql)
-- NU RULA — folosește 002_calendar_v1_schema.sql după aprobare.
CREATE TABLE IF NOT EXISTS event_category (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurrence_rule (
  id INT NOT NULL AUTO_INCREMENT,
  frequency VARCHAR(20) NOT NULL,
  `interval` INT NOT NULL DEFAULT 1,
  recurrence_days VARCHAR(100) NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_event (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  category_id INT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  duration INT NOT NULL,
  description TEXT NULL,
  recurrence_id INT NULL,
  created_by INT NOT NULL,
  location_id INT NULL,
  company_id INT NOT NULL,
  event_type VARCHAR(20) NOT NULL DEFAULT 'general',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_calendar_event_company (company_id),
  KEY idx_calendar_event_location (location_id),
  KEY idx_calendar_event_start (start_datetime),
  KEY idx_calendar_event_type (event_type),
  CONSTRAINT fk_calendar_event_category
    FOREIGN KEY (category_id) REFERENCES event_category (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_calendar_event_recurrence
    FOREIGN KEY (recurrence_id) REFERENCES recurrence_rule (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_event_participant (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL,
  employee_id INT NOT NULL,
  response_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  responded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_calendar_event_participant (event_id, employee_id),
  KEY idx_calendar_event_participant_employee (employee_id),
  CONSTRAINT fk_calendar_event_participant_event
    FOREIGN KEY (event_id) REFERENCES calendar_event (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
