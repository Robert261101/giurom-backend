/**
 * GIU-15: asigură permisiunile stock.waste_own / stock.waste_approve în catalog
 * și acordă waste_approve doar rolului admin (nu angajatului).
 *
 * Employee plain primește waste_own din PLAIN_EMPLOYEE_BASELINE_PERMISSIONS la login
 * (JWT), chiar fără rol DB „angajat”.
 *
 * Usage: node scripts/seed-stock-waste-permissions.js
 */
const mysql = require('mysql2/promise');

async function ensurePermission(conn, name, group, description) {
  const [existing] = await conn.query(
    'SELECT id, name FROM permissions WHERE name = ? LIMIT 1',
    [name],
  );
  if (existing.length > 0) {
    return Number(existing[0].id);
  }
  const [result] = await conn.query(
    'INSERT INTO permissions (name, `group`, description) VALUES (?, ?, ?)',
    [name, group, description],
  );
  return Number(result.insertId);
}

async function ensureRolePermission(conn, roleName, permissionId) {
  const [roles] = await conn.query(
    'SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [roleName],
  );
  if (!roles.length) {
    console.log(`role "${roleName}" missing — skip grant`);
    return;
  }
  const roleId = Number(roles[0].id);
  const [existing] = await conn.query(
    'SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1',
    [roleId, permissionId],
  );
  if (existing.length > 0) {
    console.log(`role "${roleName}" already has permission_id=${permissionId}`);
    return;
  }
  await conn.query(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
    [roleId, permissionId],
  );
  console.log(`granted permission_id=${permissionId} to role "${roleName}"`);
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_AUTH_NAME || 'giurombitap_auth',
  });

  const wasteOwnId = await ensurePermission(
    conn,
    'stock.waste_own',
    'stock',
    'Employee may create own waste/dispose requests (pending until approved)',
  );
  const wasteApproveId = await ensurePermission(
    conn,
    'stock.waste_approve',
    'stock',
    'Approve or reject pending waste requests; auto-approve when creator also has this',
  );
  const consumeOwnId = await ensurePermission(
    conn,
    'stock.consume_own',
    'stock',
    'Employee may consume products for own shift usage',
  );

  console.log({
    'stock.waste_own': wasteOwnId,
    'stock.waste_approve': wasteApproveId,
    'stock.consume_own': consumeOwnId,
  });

  // Admin poate aproba; employee NU primește waste_approve pe rol.
  await ensureRolePermission(conn, 'admin', wasteApproveId);

  // Opțional: dacă există rol angajat în DB, atașează waste_own (JWT baseline acoperă și fără rol).
  await ensureRolePermission(conn, 'angajat', wasteOwnId);
  await ensureRolePermission(conn, 'employee', wasteOwnId);

  const [check] = await conn.query(
    `SELECT p.name, r.name AS role
     FROM permissions p
     LEFT JOIN role_permissions rp ON rp.permission_id = p.id
     LEFT JOIN roles r ON r.id = rp.role_id
     WHERE p.name IN ('stock.waste_own', 'stock.waste_approve', 'stock.consume_own')
     ORDER BY p.name, r.name`,
  );
  console.log('catalog + grants', JSON.stringify(check, null, 2));

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
