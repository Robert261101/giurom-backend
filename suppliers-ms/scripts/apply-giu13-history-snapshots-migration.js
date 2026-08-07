const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'giurombitap_suppliers',
    multipleStatements: true,
  });

  const sqlPath = path.join(
    __dirname,
    '..',
    'migrations',
    '20260806_giu13_price_history_name_and_standard_snapshots.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await conn.query(sql);

  const [cols] = await conn.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'supplier_product_client_price_history'
      AND COLUMN_NAME IN (
        'changed_by_name',
        'standard_price_snapshot',
        'standard_price_with_vat_snapshot'
      )
    ORDER BY COLUMN_NAME
  `);
  console.log(
    'history snapshot cols:',
    cols.map((c) => c.COLUMN_NAME).join(',') || '(none)',
  );

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
