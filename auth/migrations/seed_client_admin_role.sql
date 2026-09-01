-- Seed: permission users.assign_role + role client-admin + baseline angajat (allowlist).
-- Idempotent. Run:
--   mysql ... giurombitap_auth < seed_client_admin_role.sql

-- 1. Ensure users.assign_role exists
INSERT INTO permissions (name, `group`, description)
SELECT 'users.assign_role', 'users', 'Atribuire / eliminare roluri pentru utilizatori din propria companie'
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = 'users.assign_role');

-- 2. Ensure operational allowlist roles exist (minimal baseline)
INSERT INTO roles (name, description)
SELECT 'angajat', 'Angajat standard (tenant)'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'angajat');

INSERT INTO roles (name, description)
SELECT 'magazioner', 'Magazioner operațional'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'magazioner');

INSERT INTO roles (name, description)
SELECT 'sofer', 'Șofer operațional'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'sofer');

-- 3. Create client-admin role
INSERT INTO roles (name, description)
SELECT 'client-admin', 'Administrator tenant client (doar propria firmă)'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'client-admin');

-- 4. Ensure all permissions referenced by client-admin exist (no-op if already present)
INSERT INTO permissions (name, `group`, description)
SELECT v.name, v.grp, v.descr FROM (
  SELECT 'companies.read_own' AS name, 'companies' AS grp, 'Citire firme proprii' AS descr
  UNION ALL SELECT 'companies.update', 'companies', 'Actualizare companii'
  UNION ALL SELECT 'companies.delete', 'companies', 'Stergere companii'
  UNION ALL SELECT 'locations.read', 'locations', 'Citire locatii'
  UNION ALL SELECT 'locations.create', 'locations', 'Creare locatii'
  UNION ALL SELECT 'locations.update', 'locations', 'Actualizare locatii'
  UNION ALL SELECT 'locations.delete', 'locations', 'Stergere locatii'
  UNION ALL SELECT 'employees.read', 'employees', 'Citire angajati'
  UNION ALL SELECT 'employees.read_own', 'employees', 'Citire angajati proprii'
  UNION ALL SELECT 'employees.create', 'employees', 'Creare angajati'
  UNION ALL SELECT 'employees.update', 'employees', 'Actualizare angajati'
  UNION ALL SELECT 'employees.delete', 'employees', 'Stergere angajati'
  UNION ALL SELECT 'users.read', 'users', 'Citire utilizatori'
  UNION ALL SELECT 'users.create', 'users', 'Creare utilizatori'
  UNION ALL SELECT 'users.assign_role', 'users', 'Atribuire roluri utilizatori'
  UNION ALL SELECT 'suppliers.read', 'suppliers', 'Citire furnizori'
  UNION ALL SELECT 'suppliers.create', 'suppliers', 'Creare furnizori'
  UNION ALL SELECT 'suppliers.update', 'suppliers', 'Actualizare furnizori'
  UNION ALL SELECT 'suppliers.delete', 'suppliers', 'Stergere furnizori'
  UNION ALL SELECT 'assignment.read_company', 'assignment', 'Citire sarcini companie'
  UNION ALL SELECT 'assignment.read_location', 'assignment', 'Citire sarcini locatie'
  UNION ALL SELECT 'assignment.read_own', 'assignment', 'Citire sarcini proprii'
  UNION ALL SELECT 'assignment.create', 'assignment', 'Creare sarcini'
  UNION ALL SELECT 'assignment.update', 'assignment', 'Actualizare sarcini'
  UNION ALL SELECT 'assignment.delete', 'assignment', 'Stergere sarcini'
  UNION ALL SELECT 'execution.read_company', 'execution', 'Citire executii companie'
  UNION ALL SELECT 'execution.read_location', 'execution', 'Citire executii locatie'
  UNION ALL SELECT 'execution.read_own', 'execution', 'Citire executii proprii'
  UNION ALL SELECT 'execution.read', 'execution', 'Citire executii'
  UNION ALL SELECT 'execution.create', 'execution', 'Creare executii'
  UNION ALL SELECT 'execution.update', 'execution', 'Actualizare executii'
  UNION ALL SELECT 'template.read', 'template', 'Citire sabloane'
  UNION ALL SELECT 'template.create', 'template', 'Creare sabloane'
  UNION ALL SELECT 'template.update', 'template', 'Actualizare sabloane'
  UNION ALL SELECT 'template.delete', 'template', 'Stergere sabloane'
  UNION ALL SELECT 'order.read', 'suppliers', 'Citire comenzi'
  UNION ALL SELECT 'order.create', 'suppliers', 'Creare comenzi'
  UNION ALL SELECT 'order.update', 'suppliers', 'Actualizare comenzi'
  UNION ALL SELECT 'order.cancel', 'suppliers', 'Anulare comenzi'
  UNION ALL SELECT 'order.reception', 'suppliers', 'Receptie comenzi'
  UNION ALL SELECT 'order.approve', 'suppliers', 'Aprobare receptii'
  UNION ALL SELECT 'stock.read', 'stock', 'Citire stoc'
  UNION ALL SELECT 'stock.create', 'stock', 'Creare stoc'
  UNION ALL SELECT 'stock.update', 'stock', 'Actualizare stoc'
  UNION ALL SELECT 'stock.delete', 'stock', 'Stergere stoc'
  UNION ALL SELECT 'stock.consume_own', 'stock', 'Consum propriu'
  UNION ALL SELECT 'stock.waste_own', 'stock', 'Aruncare proprie'
  UNION ALL SELECT 'stock.waste_approve', 'stock', 'Aprobare aruncare'
  UNION ALL SELECT 'products.read', 'stock', 'Citire produse'
  UNION ALL SELECT 'recipes.read', 'recipes', 'Citire retete'
  UNION ALL SELECT 'recipes.create', 'recipes', 'Creare retete'
  UNION ALL SELECT 'recipes.update', 'recipes', 'Actualizare retete'
  UNION ALL SELECT 'recipes.delete', 'recipes', 'Stergere retete'
  UNION ALL SELECT 'preparation.read', 'recipes', 'Citire preparate'
  UNION ALL SELECT 'preparation.create', 'recipes', 'Creare preparate'
  UNION ALL SELECT 'preparation.update', 'recipes', 'Actualizare preparate'
  UNION ALL SELECT 'preparation.delete', 'recipes', 'Stergere preparate'
  UNION ALL SELECT 'attendance.read', 'attendance', 'Citire pontaj'
  UNION ALL SELECT 'attendance.create', 'attendance', 'Creare pontaj'
  UNION ALL SELECT 'attendance.update', 'attendance', 'Actualizare pontaj'
  UNION ALL SELECT 'attendance.delete', 'attendance', 'Stergere pontaj'
  UNION ALL SELECT 'calendar.read', 'calendar', 'Citire calendar'
  UNION ALL SELECT 'calendar.create', 'calendar', 'Creare evenimente'
  UNION ALL SELECT 'calendar.update', 'calendar', 'Actualizare evenimente'
  UNION ALL SELECT 'calendar.delete', 'calendar', 'Stergere evenimente'
  UNION ALL SELECT 'leave-requests.read', 'requests', 'Citire concedii'
  UNION ALL SELECT 'leave-requests.create', 'requests', 'Creare concedii'
  UNION ALL SELECT 'leave-requests.update', 'requests', 'Actualizare concedii'
  UNION ALL SELECT 'leave-requests.delete', 'requests', 'Stergere concedii'
  UNION ALL SELECT 'leaves.read', 'leaves', 'Citire leaves'
  UNION ALL SELECT 'leaves.create', 'leaves', 'Creare leaves'
  UNION ALL SELECT 'leaves.update', 'leaves', 'Actualizare leaves'
  UNION ALL SELECT 'leaves.delete', 'leaves', 'Stergere leaves'
  UNION ALL SELECT 'shift-change-requests.read', 'requests', 'Citire schimb ture'
  UNION ALL SELECT 'shift-change-requests.create', 'requests', 'Creare schimb ture'
  UNION ALL SELECT 'shift-change-requests.update', 'requests', 'Actualizare schimb ture'
  UNION ALL SELECT 'shift-change-requests.delete', 'requests', 'Stergere schimb ture'
  UNION ALL SELECT 'cashing.create', 'locations', 'Inregistrare incasari'
  UNION ALL SELECT 'waste-records.read', 'waste-records', 'Citire waste records'
  UNION ALL SELECT 'waste-records.create', 'waste-records', 'Creare waste records'
  UNION ALL SELECT 'waste-records.update', 'waste-records', 'Actualizare waste records'
  UNION ALL SELECT 'waste-records.delete', 'waste-records', 'Stergere waste records'
) v
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

-- 5. Attach permissions to client-admin (tenant-scoped set; NO *read_all / companies.read / permissions.*)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'companies.read_own', 'companies.update', 'companies.delete',
  'locations.read', 'locations.create', 'locations.update', 'locations.delete',
  'employees.read', 'employees.read_own', 'employees.create', 'employees.update', 'employees.delete',
  'users.read', 'users.create', 'users.assign_role',
  'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'assignment.read_company', 'assignment.read_location', 'assignment.read_own',
  'assignment.create', 'assignment.update', 'assignment.delete',
  'execution.read_company', 'execution.read_location', 'execution.read_own',
  'execution.read', 'execution.create', 'execution.update',
  'template.read', 'template.create', 'template.update', 'template.delete',
  'order.read', 'order.create', 'order.update', 'order.cancel', 'order.reception', 'order.approve',
  'stock.read', 'stock.create', 'stock.update', 'stock.delete',
  'stock.consume_own', 'stock.waste_own', 'stock.waste_approve',
  'products.read',
  'recipes.read', 'recipes.create', 'recipes.update', 'recipes.delete',
  'preparation.read', 'preparation.create', 'preparation.update', 'preparation.delete',
  'attendance.read', 'attendance.create', 'attendance.update', 'attendance.delete',
  'calendar.read', 'calendar.create', 'calendar.update', 'calendar.delete',
  'leave-requests.read', 'leave-requests.create', 'leave-requests.update', 'leave-requests.delete',
  'leaves.read', 'leaves.create', 'leaves.update', 'leaves.delete',
  'shift-change-requests.read', 'shift-change-requests.create',
  'shift-change-requests.update', 'shift-change-requests.delete',
  'cashing.create',
  'waste-records.read', 'waste-records.create', 'waste-records.update', 'waste-records.delete'
)
WHERE r.name = 'client-admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 6. Minimal safe permissions for angajat (allowlist target)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'assignment.read_own', 'execution.read_own', 'execution.create',
  'attendance.read', 'calendar.read', 'leaves.read', 'leave-requests.read', 'leave-requests.create'
)
WHERE r.name = 'angajat'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
