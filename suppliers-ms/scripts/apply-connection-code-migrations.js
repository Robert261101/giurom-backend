const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
  });

  for (const f of [
    'migrations/20260826_supplier_connection_code.sql',
    'migrations/20260826_client_supplier_links.sql',
    'migrations/20260907_client_supplier_connection_attempts.sql',
  ]) {
    const sql = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    try {
      await c.query(sql);
      console.log('OK', f);
    } catch (e) {
      console.log('ERR', f, e.code || '', e.message);
    }
  }

  const [cols] = await c.query("SHOW COLUMNS FROM suppliers LIKE 'connection_code'");
  console.log('column', cols);
  const [tbl] = await c.query("SHOW TABLES LIKE 'client_supplier_links'");
  console.log('table', tbl);
  const [attempts] = await c.query(
    "SHOW TABLES LIKE 'client_supplier_connection_attempts'",
  );
  console.log('attempts_table', attempts);
  const [attemptCols] = await c.query(
    'SHOW COLUMNS FROM client_supplier_connection_attempts',
  );
  console.log('attempts_columns', attemptCols.map((c) => c.Field));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
