/**
 * Aplică migrarea de branding (logo + paletă per firmă).
 *   node scripts/apply-branding-migration.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const file = path.join(__dirname, '..', 'migrations', '20260904_01_company_branding.sql');
  const sql = fs.readFileSync(file, 'utf8');

  const dbName = process.env.DB_DATABASE || 'giurombitap_company';
  // `localhost` pe Windows poate forța auth_gssapi / named pipe; 127.0.0.1 = TCP.
  const host = process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1');
  const c = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: dbName,
    multipleStatements: true,
  });

  console.log(`Connected to ${dbName}`);
  console.log('Applying 20260904_01_company_branding.sql...');
  await c.query(sql);
  console.log('OK');

  const [rows] = await c.query(
    'SELECT company_id, logo_file, logo_version, color_primary, updated_at FROM company_branding ORDER BY company_id LIMIT 20',
  );
  console.table(rows);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
