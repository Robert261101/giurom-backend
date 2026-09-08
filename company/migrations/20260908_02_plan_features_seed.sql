-- Seed plan features (idempotent). Matrix confirmed 2026-09-07.
-- CLIENT: free = dashboard, comenzi, furnizori, locatii, necesar
--         silver = free + angajati, pontaj
--         gold = silver + concedii, evenimente, sarcini, stoc, retetar, rapoarte,
--                arunca_consuma, incasare, firme
-- FURNIZOR: free = dashboard, comenzi, clienti, stoc, locatii, angajati, pontaj, staff_ops
--           silver = free + sarcini, evenimente
--           gold = silver + concedii, rapoarte
-- Setari / abonament / notificari are never gated (not in catalog).

INSERT IGNORE INTO plan_features (plan_code, company_type, feature_key) VALUES
  -- client / free
  ('free', 'client', 'dashboard'),
  ('free', 'client', 'comenzi'),
  ('free', 'client', 'furnizori'),
  ('free', 'client', 'locatii'),
  ('free', 'client', 'necesar'),
  -- client / silver
  ('silver', 'client', 'dashboard'),
  ('silver', 'client', 'comenzi'),
  ('silver', 'client', 'furnizori'),
  ('silver', 'client', 'locatii'),
  ('silver', 'client', 'necesar'),
  ('silver', 'client', 'angajati'),
  ('silver', 'client', 'pontaj'),
  -- client / gold
  ('gold', 'client', 'dashboard'),
  ('gold', 'client', 'comenzi'),
  ('gold', 'client', 'furnizori'),
  ('gold', 'client', 'locatii'),
  ('gold', 'client', 'necesar'),
  ('gold', 'client', 'angajati'),
  ('gold', 'client', 'pontaj'),
  ('gold', 'client', 'concedii'),
  ('gold', 'client', 'evenimente'),
  ('gold', 'client', 'sarcini'),
  ('gold', 'client', 'stoc'),
  ('gold', 'client', 'retetar'),
  ('gold', 'client', 'rapoarte'),
  ('gold', 'client', 'arunca_consuma'),
  ('gold', 'client', 'incasare'),
  ('gold', 'client', 'firme'),
  -- furnizor / free
  ('free', 'furnizor', 'dashboard'),
  ('free', 'furnizor', 'comenzi'),
  ('free', 'furnizor', 'clienti'),
  ('free', 'furnizor', 'stoc'),
  ('free', 'furnizor', 'locatii'),
  ('free', 'furnizor', 'angajati'),
  ('free', 'furnizor', 'pontaj'),
  ('free', 'furnizor', 'staff_ops'),
  -- furnizor / silver
  ('silver', 'furnizor', 'dashboard'),
  ('silver', 'furnizor', 'comenzi'),
  ('silver', 'furnizor', 'clienti'),
  ('silver', 'furnizor', 'stoc'),
  ('silver', 'furnizor', 'locatii'),
  ('silver', 'furnizor', 'angajati'),
  ('silver', 'furnizor', 'pontaj'),
  ('silver', 'furnizor', 'staff_ops'),
  ('silver', 'furnizor', 'sarcini'),
  ('silver', 'furnizor', 'evenimente'),
  -- furnizor / gold
  ('gold', 'furnizor', 'dashboard'),
  ('gold', 'furnizor', 'comenzi'),
  ('gold', 'furnizor', 'clienti'),
  ('gold', 'furnizor', 'stoc'),
  ('gold', 'furnizor', 'locatii'),
  ('gold', 'furnizor', 'angajati'),
  ('gold', 'furnizor', 'pontaj'),
  ('gold', 'furnizor', 'staff_ops'),
  ('gold', 'furnizor', 'sarcini'),
  ('gold', 'furnizor', 'evenimente'),
  ('gold', 'furnizor', 'concedii'),
  ('gold', 'furnizor', 'rapoarte');
