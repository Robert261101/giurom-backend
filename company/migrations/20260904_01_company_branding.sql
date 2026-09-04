-- Logo + paleta de culori, per firma. Ruleaza pe baza din company/.env.
-- Idempotent: safe to re-run.
--
-- `company_id = 0` este randul implicit al platformei: ce vede o firma care n-a
-- configurat nimic. Zero in loc de NULL fiindca pe MySQL un index unic accepta
-- oricate NULL-uri — s-ar putea strecura doua randuri "implicite" fara eroare.
--
-- Culorile sunt NULL pana cand cineva le atinge; NULL inseamna "foloseste implicitul
-- din cod", nu "transparent". Asa o paleta completata pe jumatate nu lasa gauri in
-- interfata.

CREATE TABLE IF NOT EXISTS company_branding (
  company_id INT NOT NULL,
  logo_file VARCHAR(255) NULL,
  logo_mime VARCHAR(100) NULL,
  logo_version INT NOT NULL DEFAULT 0,
  color_primary VARCHAR(9) NULL,
  color_primary_foreground VARCHAR(9) NULL,
  color_accent VARCHAR(9) NULL,
  color_page_bg VARCHAR(9) NULL,
  color_surface VARCHAR(9) NULL,
  color_sidebar VARCHAR(9) NULL,
  color_text VARCHAR(9) NULL,
  color_text_muted VARCHAR(9) NULL,
  color_border VARCHAR(9) NULL,
  updated_by_user_id INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Randul implicit al platformei. Fara culori: aplicatia porneste exact cum arata acum,
-- iar prima schimbare este o decizie explicita a cuiva, nu un efect al migrarii.
INSERT INTO company_branding (company_id)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM company_branding WHERE company_id = 0);
