-- Acordă rolului furnizor dreptul de a edita locațiile proprii.
-- DB: giurombitap_auth
-- Aplicat pe mediul local; rulează pe celelalte medii dacă e nevoie:
--   mysql ... giurombitap_auth < grant-furnizor-locations-update.sql

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'furnizor'
  AND p.name = 'locations.update'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
