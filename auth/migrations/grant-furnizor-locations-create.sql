-- Acordă rolului furnizor dreptul de a crea locații proprii (locations.create).
-- Completare la grant-furnizor-locations-update.sql.
-- Quota locations.max rămâne enforced pe locations-ms (freeze-create).
-- DB: giurombitap_auth
--   mysql ... giurombitap_auth < grant-furnizor-locations-create.sql

INSERT INTO permissions (name, `group`, description)
SELECT 'locations.create', 'locations', 'Permite crearea locațiilor'
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = 'locations.create');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'furnizor'
  AND p.name = 'locations.create'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
