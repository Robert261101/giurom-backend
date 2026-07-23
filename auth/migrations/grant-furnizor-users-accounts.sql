-- Acordă rolului furnizor acces la Setări → Conturi (citire listă + creare cont autentificare).
-- DB: giurombitap_auth
--   mysql ... giurombitap_auth < grant-furnizor-users-accounts.sql

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'furnizor'
  AND p.name IN ('users.read', 'users.create')
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
