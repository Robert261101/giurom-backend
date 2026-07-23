-- Creează rolul "furnizor" (lipsă din DB, cauza erorii la înregistrare
-- furnizor: "Rolul furnizor lipsește din sistem. Contactați administratorul.")
-- și îi acordă permisiunile deja pregătite pentru el în
-- grant-furnizor-locations-update.sql / grant-furnizor-users-accounts.sql.
-- Idempotent — poate fi rulat de mai multe ori și pe orice mediu.
--   mysql ... giurombitap_auth < seed_furnizor_role.sql

-- 1. Garantează că permisiunile necesare există (idempotent)
INSERT INTO permissions (name, `group`, description)
SELECT v.name, v.grp, v.descr FROM (
  SELECT 'locations.update' AS name, 'locations' AS grp, 'Permite editarea locațiilor' AS descr
  UNION ALL SELECT 'users.read', 'users', 'Vizualizare conturi de autentificare'
  UNION ALL SELECT 'users.create', 'users', 'Creare conturi de autentificare'
) v
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

-- 2. Creează rolul "furnizor" dacă nu există
INSERT INTO roles (name, description)
SELECT 'furnizor', 'Cont companie furnizor (tenant operațional)'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'furnizor');

-- 3. Leagă permisiunile de rolul "furnizor"
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('locations.update', 'users.read', 'users.create')
WHERE r.name = 'furnizor'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
